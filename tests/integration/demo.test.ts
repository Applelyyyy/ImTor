import "./guard";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { DemoService } from "@/services/demo";
import { MarketScheduleService } from "@/services/schedule";
const tag = `test-demo-${randomUUID()}`;
const batches = new Set<string>();
let genuineUserId: string;
const enabled = process.env.ENABLE_DEMO_GENERATOR;
const demoMode = process.env.DEMO_MODE;
async function generate() {
  const batch = await DemoService.generate(
    {
      stores: 3,
      products: 6,
      customers: 4,
      stalls: 8,
      zones: 4,
      reservations: 4,
    },
    tag,
  );
  batches.add(batch.id);
  return batch;
}
describe("PostgreSQL fictional demo isolation", () => {
  beforeAll(async () => {
    process.env.ENABLE_DEMO_GENERATOR = "true";
    process.env.DEMO_MODE = "true";
    const user = await db.user.create({
      data: { name: tag, email: `${tag}@example.invalid` },
    });
    genuineUserId = user.id;
  });
  afterAll(async () => {
    if (genuineUserId) {
      await db.reservation.deleteMany({ where: { userId: genuineUserId } });
      await db.storeMember.deleteMany({ where: { userId: genuineUserId } });
      for (const id of batches) {
        await db.discountRule.deleteMany({
          where: { id: { startsWith: tag }, product: { demoBatchId: id } },
        });
        await DemoService.cleanup(id, tag);
      }
      await db.user.delete({ where: { id: genuineUserId } });
    }
    await db.auditLog.deleteMany({ where: { actorId: tag } });
    if (enabled === undefined) delete process.env.ENABLE_DEMO_GENERATOR;
    else process.env.ENABLE_DEMO_GENERATOR = enabled;
    if (demoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = demoMode;
    await db.$disconnect();
  });
  it("creates a coherent labeled batch with no OAuth accounts, sessions or real coordinates", async () => {
    const batch = await generate();
    expect(await db.user.count({ where: { demoBatchId: batch.id } })).toBe(7);
    expect(
      await db.account.count({ where: { user: { demoBatchId: batch.id } } }),
    ).toBe(0);
    expect(
      await db.session.count({ where: { user: { demoBatchId: batch.id } } }),
    ).toBe(0);
    const users = await db.user.findMany({ where: { demoBatchId: batch.id } });
    expect(
      users.every((user) => user.suspended && user.email?.endsWith(".invalid")),
    ).toBe(true);
    expect(await db.store.count({ where: { demoBatchId: batch.id } })).toBe(3);
    expect(await db.product.count({ where: { demoBatchId: batch.id } })).toBe(
      6,
    );
    expect(
      await db.reservation.count({ where: { demoBatchId: batch.id } }),
    ).toBe(4);
    expect(
      await db.reservation.count({
        where: { demoBatchId: batch.id, status: "COMPLETED" },
      }),
    ).toBe(2);
    expect(
      await db.marketZone.count({
        where: { market: { demoBatchId: batch.id } },
      }),
    ).toBe(4);
    expect(
      await db.marketStall.count({
        where: { market: { demoBatchId: batch.id } },
      }),
    ).toBe(8);
    const venues = await db.marketVenue.findMany({
      where: { demoBatchId: batch.id },
    });
    expect(
      venues.every(
        (venue) =>
          venue.latitude === null &&
          venue.longitude === null &&
          venue.name.startsWith("[ตัวอย่าง]"),
      ),
    ).toBe(true);
    await DemoService.cleanup(batch.id, tag);
    batches.delete(batch.id);
    expect(await db.product.count({ where: { demoBatchId: batch.id } })).toBe(
      0,
    );
    expect(
      await db.marketVenue.count({ where: { demoBatchId: batch.id } }),
    ).toBe(0);
    expect(
      await db.user.findUnique({ where: { id: genuineUserId } }),
    ).not.toBeNull();
  });
  it("keeps an explicit pickup deadline on browse-only rescue samples", async () => {
    const batch = await DemoService.generate(
      {
        stores: 2,
        products: 9,
        customers: 2,
        stalls: 4,
        zones: 2,
        reservations: 0,
      },
      tag,
    );
    batches.add(batch.id);
    const products = await db.product.findMany({
      where: { demoBatchId: batch.id, mode: "RESCUE", reservable: false },
    });
    expect(products.length).toBeGreaterThan(0);
    expect(
      products.every(
        (product) =>
          product.pickupEnd !== null && product.pickupEnd > new Date(),
      ),
    ).toBe(true);
    expect(products.every((product) => product.stock === null)).toBe(true);
    await DemoService.cleanup(batch.id, tag);
    batches.delete(batch.id);
  });
  it("blocks cleanup before deleting anything when a nonbatch customer reserves a demo product", async () => {
    const batch = await generate();
    const product = await db.product.findFirstOrThrow({
      where: { demoBatchId: batch.id },
    });
    const reservation = await db.reservation.create({
      data: {
        userId: genuineUserId,
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        originalPrice: product.price,
        pickupCode: randomUUID(),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    await expect(DemoService.cleanup(batch.id, tag)).rejects.toThrow(
      "genuine or unowned",
    );
    expect(
      await db.reservation.findUnique({ where: { id: reservation.id } }),
    ).not.toBeNull();
    expect(await db.product.count({ where: { demoBatchId: batch.id } })).toBe(
      6,
    );
    await db.reservation.delete({ where: { id: reservation.id } });
    await DemoService.cleanup(batch.id, tag);
    batches.delete(batch.id);
  });
  it("rejects a foreign store member and foreign discount instead of cascading them away", async () => {
    const batch = await generate(),
      store = await db.store.findFirstOrThrow({
        where: { demoBatchId: batch.id },
      });
    const member = await db.storeMember.create({
      data: { storeId: store.id, userId: genuineUserId },
    });
    await expect(DemoService.cleanup(batch.id, tag)).rejects.toThrow(
      "genuine or unowned",
    );
    expect(
      await db.storeMember.findUnique({ where: { id: member.id } }),
    ).not.toBeNull();
    await db.storeMember.delete({ where: { id: member.id } });
    const product = await db.product.findFirstOrThrow({
      where: { demoBatchId: batch.id },
    });
    const rule = await db.discountRule.create({
      data: {
        id: `${tag}:foreign-rule`,
        productId: product.id,
        kind: "FIXED",
        value: 100,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60000),
      },
    });
    await expect(DemoService.cleanup(batch.id, tag)).rejects.toThrow(
      "genuine or unowned",
    );
    expect(
      await db.discountRule.findUnique({ where: { id: rule.id } }),
    ).not.toBeNull();
    await db.discountRule.delete({ where: { id: rule.id } });
    await DemoService.cleanup(batch.id, tag);
    batches.delete(batch.id);
  });
  it("materializes sessions idempotently without reopening an explicitly cancelled session", async () => {
    const batch = await generate();
    const session = await db.marketSession.findFirstOrThrow({
      where: { demoBatchId: batch.id, status: "SCHEDULED" },
    });
    await db.marketSession.update({
      where: { id: session.id },
      data: { status: "CANCELLED" },
    });
    const countBefore = await db.marketSession.count({
      where: { demoBatchId: batch.id },
    });
    await MarketScheduleService.ensureSessions();
    expect(
      await db.marketSession.count({ where: { demoBatchId: batch.id } }),
    ).toBe(countBefore);
    expect(
      (await db.marketSession.findUniqueOrThrow({ where: { id: session.id } }))
        .status,
    ).toBe("CANCELLED");
    await DemoService.cleanup(batch.id, tag);
    batches.delete(batch.id);
  });
});
