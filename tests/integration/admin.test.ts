import "./guard";
import { afterAll, beforeAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AdminService } from "@/services/admin";
let actor: Awaited<ReturnType<typeof db.user.create>>,
  market: Awaited<ReturnType<typeof db.marketVenue.create>>,
  store: Awaited<ReturnType<typeof db.store.create>>;
const tag = "admin-test-" + randomUUID().slice(0, 8);
beforeAll(async () => {
  actor = await db.user.create({ data: { name: tag, role: "SUPERADMIN" } });
  store = await db.store.create({
    data: { name: tag, slug: tag, ownerId: actor.id },
  });
  market = await db.marketVenue.create({ data: { name: tag, slug: tag } });
});
afterAll(async () => {
  await db.marketVenue.delete({ where: { id: market.id } });
  await db.store.delete({ where: { id: store.id } });
  await db.user.delete({ where: { id: actor.id } });
  await db.auditLog.deleteMany({ where: { actorId: actor.id } });
  await db.$disconnect();
});
it("permits safe schedule edits after cancelling a referenced session without reviving it", async () => {
  const session = await db.marketSession.create({
    data: {
      marketId: market.id,
      date: "2099-01-01",
      startsAt: new Date("2099-01-01T09:00:00Z"),
      endsAt: new Date("2099-01-01T14:00:00Z"),
    },
  });
  await db.storeAttendance.create({
    data: { storeId: store.id, sessionId: session.id },
  });
  await expect(
    AdminService.rule(actor, market.id, {
      weekday: 1,
      opens: "16:00",
      closes: "21:00",
    }),
  ).rejects.toThrow();
  await AdminService.session(actor, session.id, "CANCELLED");
  await expect(
    AdminService.rule(actor, market.id, {
      weekday: 1,
      opens: "17:00",
      closes: "21:00",
    }),
  ).resolves.toMatchObject({ opens: "17:00" });
  expect(
    (await db.marketSession.findUniqueOrThrow({ where: { id: session.id } }))
      .status,
  ).toBe("CANCELLED");
});
it("baseline categories exist without demo generation", async () => {
  expect(
    await db.productCategory.count({
      where: {
        id: {
          in: [
            "meals",
            "snacks",
            "drinks",
            "bakery",
            "groceries",
            "goods",
            "other",
          ],
        },
      },
    }),
  ).toBe(7);
});
it("rejects removing the final active super-admin", async () => {
  expect(
    await db.user.count({ where: { role: "SUPERADMIN", suspended: false } }),
  ).toBe(1);
  await expect(
    AdminService.user(actor, actor.id, { role: "USER" }),
  ).rejects.toThrow("ต้องเหลือ");
  await expect(
    AdminService.user(actor, actor.id, { suspended: true }),
  ).rejects.toThrow("ต้องเหลือ");
});
