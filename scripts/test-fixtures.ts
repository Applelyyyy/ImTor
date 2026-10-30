import "dotenv/config";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { db } from "../src/lib/db";
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Isolated local tests only");
const path = "test-results/fixtures.json";
if (process.argv[2] === "cleanup") {
  const f = JSON.parse(await readFile(path, "utf8")) as {
    users: { id: string }[];
    categoryId: string;
    marketId: string;
    extraMarketId?: string;
  };
  const ids = f.users.map((u) => u.id);
  const stores = await db.store.findMany({
    where: { ownerId: { in: ids } },
    select: { id: true },
  });
  const storeIds = stores.map((s) => s.id);
  await db.inventoryMovement.deleteMany({
    where: { product: { storeId: { in: storeIds } } },
  });
  await db.reservation.deleteMany({
    where: {
      OR: [{ userId: { in: ids } }, { product: { storeId: { in: storeIds } } }],
    },
  });
  await db.product.deleteMany({ where: { storeId: { in: storeIds } } });
  await db.store.deleteMany({ where: { id: { in: storeIds } } });
  await db.marketVenue.deleteMany({
    where: {
      id: { in: [f.marketId, f.extraMarketId].filter((v): v is string => !!v) },
    },
  });
  await db.upload.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.productCategory.delete({ where: { id: f.categoryId } });
  await unlink(path);
  console.log("Isolated browser fixtures removed");
} else {
  const tag = "e2e-" + randomUUID().slice(0, 8);
  const users: { id: string; token: string; role: string }[] = [];
  for (const role of ["SUPERADMIN", "USER", "USER"]) {
    const user = await db.user.create({
      data: {
        name: tag + " " + role,
        email: `${tag}-${users.length}@example.invalid`,
        role,
      },
    });
    const token = randomBytes(32).toString("hex");
    await db.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expires: new Date(Date.now() + 3600000),
      },
    });
    users.push({ id: user.id, token, role });
  }
  const category = await db.productCategory.create({
    data: { id: tag, name: "เครื่องดื่มทดสอบ", food: true },
  });
  const market = await db.marketVenue.create({
    data: {
      slug: tag,
      name: "ตลาดทดสอบระบบ",
      description: "ข้อมูลทดสอบ ไม่ใช่สถานที่จริง",
      address: "ตำแหน่งสำหรับการทดสอบเท่านั้น",
    },
  });
  const zone = await db.marketZone.create({
    data: { marketId: market.id, name: "A" },
  });
  const stall = await db.marketStall.create({
    data: { marketId: market.id, zoneId: zone.id, code: "A99", x: 0.4, y: 0.5 },
  });
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const session = await db.marketSession.create({
    data: {
      marketId: market.id,
      date,
      startsAt: new Date(Date.now() - 60000),
      endsAt: new Date(Date.now() + 3600000),
    },
  });
  await mkdir("test-results", { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      tag,
      users,
      categoryId: category.id,
      marketId: market.id,
      marketSlug: market.slug,
      sessionId: session.id,
      stallId: stall.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    "Isolated test sessions created outside application; no login bypass enabled",
  );
}
await db.$disconnect();
