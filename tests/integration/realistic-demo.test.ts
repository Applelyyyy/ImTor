import "./guard";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { RealisticDemoService } from "@/services/realistic-demo";
import { DemoService } from "@/services/demo";
import { loadDemoState } from "@/services/demo-state";
import { PricingService } from "@/services/pricing";
import { DEMO_ASSET_KEYS } from "@/data/demo-catalog";
const tag = `realistic-test-${randomUUID()}`;
const batches = new Set<string>();
const previous = { enabled: process.env.ENABLE_DEMO_GENERATOR, demo: process.env.DEMO_MODE };
let actorId: string;
const urls = Object.fromEntries(DEMO_ASSET_KEYS.map((key) => [key, `https://demo.example.invalid/${key}.webp`]));

describe("realistic persisted demo graph", () => {
  beforeAll(async () => {
    process.env.ENABLE_DEMO_GENERATOR = "true";
    process.env.DEMO_MODE = "true";
    actorId = (await db.user.create({ data: { name: tag, role: "ADMIN", email: `${tag}@example.invalid` } })).id;
  });
  afterAll(async () => {
    for (const batchId of batches) {
      if (await db.demoBatch.findUnique({ where: { id: batchId } })) await DemoService.cleanup(batchId, actorId);
      await db.systemSetting.deleteMany({ where: { key: `demo:${batchId}` } });
    }
    if (actorId) {
      await db.auditLog.deleteMany({ where: { actorId } });
      await db.user.delete({ where: { id: actorId } });
    }
    if (previous.enabled === undefined) delete process.env.ENABLE_DEMO_GENERATOR; else process.env.ENABLE_DEMO_GENERATOR = previous.enabled;
    if (previous.demo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = previous.demo;
  });
  it("reserves a batch idempotently, rejects mismatched configuration and non-admin operators", async () => {
    const config = { idempotencyKey: `${tag}-idempotent`, stores: 3, products: 9, customers: 4, reservations: 12, stalls: 8, zones: 4 };
    await expect(RealisticDemoService.create(config, "missing-admin")).rejects.toThrow();
    batches.add(`realistic_${createHash("sha256").update(config.idempotencyKey).digest("hex").slice(0, 32)}`);
    const [first, second] = await Promise.all([RealisticDemoService.create(config, actorId), RealisticDemoService.create(config, actorId)]);
    batches.add(first.batchId);
    expect(first).toEqual(second);
    expect(first.stage).toBe("MEDIA");
    expect(await loadDemoState(first.batchId)).toEqual(first);
    await expect(RealisticDemoService.create({ ...config, products: 10 }, actorId)).rejects.toThrow(/configuration/i);
    await RealisticDemoService.populate(first.batchId, actorId, urls);
    await RealisticDemoService.populate(first.batchId, actorId, urls);
    const result = await RealisticDemoService.validate(first.batchId);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.counts).toMatchObject({ stores: 3, products: 9, users: 7, reservations: 12 });
  });
  it("generates the full coherent 30/150/100/250 batch without fake identities or stock repairs", async () => {
    const state = await RealisticDemoService.create({ idempotencyKey: `${tag}-full` }, actorId);
    batches.add(state.batchId);
    const populated = await RealisticDemoService.populate(state.batchId, actorId, urls);
    expect(populated.stage).toBe("VALIDATE");
    const result = await RealisticDemoService.validate(state.batchId);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.counts).toMatchObject({ stores: 30, products: 150, users: 130, reservations: 250, markets: 2, zones: 8, stalls: 80, archivedProducts: 20, publicProducts: 130, discountedProducts: 40, rescueProducts: 20, smallStalls: 28, largeStalls: 52 });
    expect(result.counts.attendances).toBeGreaterThanOrEqual(80);
    const products = await db.product.findMany({ where: { demoBatchId: state.batchId }, include: { movements: true, discounts: true, reservations: true, session: true, store: true } });
    for (const product of products) {
      expect(product.stock).toBe(product.movements.reduce((sum, movement) => sum + movement.delta, 0));
      expect(product.movements.filter((movement) => movement.reason === "DEMO_OPENING")).toHaveLength(1);
      expect(product.pickupStart).toEqual(product.session?.startsAt);
      expect(product.pickupEnd).toEqual(product.session?.endsAt);
      expect(product.createdAt.getTime()).toBeLessThanOrEqual(product.reservations[0]?.createdAt.getTime() ?? Date.parse(state.asOf));
      for (const reservation of product.reservations) {
        expect(reservation.unitPrice).toBe(PricingService.calculate(product.price, product.discounts, reservation.createdAt).current);
        expect(reservation.createdAt.getTime()).toBeLessThanOrEqual(Date.parse(state.asOf));
        expect(reservation.completedAt?.getTime() ?? 0).toBeLessThanOrEqual(Date.parse(state.asOf));
        expect(reservation.createdAt.getTime()).toBeGreaterThanOrEqual(product.session!.startsAt.getTime());
      }
    }
    expect(new Set(products.map((product) => product.imageUrl)).size).toBe(40);
    const users = await db.user.findMany({ where: { demoBatchId: state.batchId }, include: { accounts: true, sessions: true } });
    expect(users.every((user) => user.suspended && user.email?.endsWith(".invalid") && !user.accounts.length && !user.sessions.length)).toBe(true);
    expect((await loadDemoState(state.batchId))?.stage).toBe("READY");
    const changed = products[0];
    await db.product.update({ where: { id: changed.id }, data: { stock: { increment: 1 } } });
    const bad = await RealisticDemoService.validate(state.batchId);
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((error) => error.includes("inventory"))).toBe(true);
    await db.product.update({ where: { id: changed.id }, data: { stock: { decrement: 1 } } });
  }, 120000);
});
