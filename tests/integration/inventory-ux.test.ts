import "./guard";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ProductService, StoreService } from "@/services/products";
import { InventoryService } from "@/services/inventory";
import { ReservationService } from "@/services/reservations";

const tag = `inventory-ux-${randomUUID()}`;
let owner: Awaited<ReturnType<typeof db.user.create>>;
let customer: typeof owner;
let other: typeof owner;
let admin: typeof owner;
let store: Awaited<ReturnType<typeof db.store.create>>;
const categoryId = `${tag}-category`;
async function create(stock = 10) {
  return ProductService.create(owner, { storeId: store.id, name: `${tag} ข้าวกะเพรา`, imageUrl: "/images/rice.jpg", categoryId, price: 5000, reservable: true, stock, pickupStart: new Date(Date.now() - 60_000).toISOString(), pickupEnd: new Date(Date.now() + 3600_000).toISOString() });
}
async function balance(productId: string) {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const reservations = await db.reservation.findMany({ where: { productId } });
  return { available: product.stock, reserved: reservations.filter((r) => r.status === "RESERVED").reduce((n, r) => n + r.quantity, 0), completed: reservations.filter((r) => r.status === "COMPLETED").reduce((n, r) => n + r.quantity, 0) };
}
async function ledger(productId: string) {
  return (await db.inventoryMovement.aggregate({ where: { productId }, _sum: { delta: true } }))._sum.delta ?? 0;
}
describe("merchant inventory authoritative PostgreSQL behavior", () => {
  beforeAll(async () => {
    [owner, customer, other, admin] = await Promise.all(["owner", "customer", "other", "admin"].map((kind) => db.user.create({ data: { name: `${tag}-${kind}`, email: `${tag}-${kind}@example.invalid`, role: kind === "admin" ? "ADMIN" : "USER" } })));
    store = await db.store.create({ data: { name: tag, slug: tag, ownerId: owner.id, kind: "PERMANENT", open: true } });
    await db.productCategory.create({ data: { id: categoryId, name: tag, food: true } });
  });
  afterAll(async () => {
    if (store) {
      await db.inventoryMovement.deleteMany({ where: { product: { storeId: store.id } } });
      await db.reservation.deleteMany({ where: { product: { storeId: store.id } } });
      await db.product.deleteMany({ where: { storeId: store.id } });
      await db.store.delete({ where: { id: store.id } });
    }
    const ids = [owner?.id, customer?.id, other?.id, admin?.id].filter(Boolean);
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.upload.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.productCategory.deleteMany({ where: { id: categoryId } });
  });
  it("persists tracked display-only100, atomically edits50, and retains quantity after a fresh read", async () => {
    const p = await ProductService.create(owner, { storeId: store.id, name: tag, imageUrl: "/images/rice.jpg", categoryId, price: 5000, reservable: false, stock: 100 });
    expect(p.stock).toBe(100);
    expect(await ledger(p.id)).toBe(100);
    expect(await InventoryService.summary(owner, p.id)).toMatchObject({ available: 100 });
    const edited = await ProductService.update(owner, p.id, { stock: 50, expectedStock: 100, stockAdjustmentKey: randomUUID() });
    expect(edited.stock).toBe(50);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(50);
    expect(await ledger(p.id)).toBe(50);
    expect(await InventoryService.adjust(owner, p.id, { operation: "add", quantity: 1, idempotencyKey: randomUUID() })).toMatchObject({ available: 51 });
    await expect(ReservationService.create(customer, p.id, 1)).rejects.toThrow();
  });
  it("rejects unsafe display-only absolute writes and preserves explicit null and zero tracking transitions", async () => {
    const p = await create();
    await ProductService.update(owner, p.id, { reservable: false });
    expect((await balance(p.id)).available).toBe(10);
    await expect(ProductService.update(owner, p.id, { stock: 9 })).rejects.toMatchObject({ status: 409 });
    await ProductService.update(owner, p.id, { stock: 0, expectedStock: 10, stockAdjustmentKey: randomUUID() });
    expect((await balance(p.id)).available).toBe(0);
    await ProductService.update(owner, p.id, { stock: null, expectedStock: 0, stockAdjustmentKey: randomUUID() });
    expect((await balance(p.id)).available).toBeNull();
    await ProductService.update(owner, p.id, { stock: 0, expectedStock: null, stockAdjustmentKey: randomUUID() });
    expect((await balance(p.id)).available).toBe(0);
    expect(await ledger(p.id)).toBe(0);
    expect(await db.inventoryMovement.count({ where: { productId: p.id, reason: { startsWith: "MANAGEMENT_DISABLED" } } })).toBe(1);
    expect(await db.inventoryMovement.count({ where: { productId: p.id, reason: { startsWith: "MANAGEMENT_ENABLED" } } })).toBe(1);
  });
  it("target edits bind retries, preserve later bookings, and reject stale expected stock", async () => {
    const p = await create(100), key = randomUUID();
    const input = { stock: 50, expectedStock: 100, stockAdjustmentKey: key };
    await Promise.all([ProductService.update(owner, p.id, input), ProductService.update(owner, p.id, input)]);
    await ReservationService.create(customer, p.id, 2);
    expect((await ProductService.update(owner, p.id, input)).stock).toBe(48);
    expect(await ledger(p.id)).toBe(48);
    await expect(ProductService.update(owner, p.id, { ...input, stock: 60 })).rejects.toMatchObject({ status: 409 });
    await expect(ProductService.update(owner, p.id, { stock: 49, expectedStock: 50, stockAdjustmentKey: randomUUID() })).rejects.toMatchObject({ status: 409 });
    await ProductService.update(owner, p.id, { stock: 40, expectedStock: 48, stockAdjustmentKey: randomUUID() });
    expect(await balance(p.id)).toEqual({ available: 40, reserved: 2, completed: 0 });
    await expect(ProductService.update(owner, p.id, { stock: null, expectedStock: 40, stockAdjustmentKey: randomUUID(), reservable: false })).rejects.toMatchObject({ status: 409 });
    const otherProduct = await create(100);
    await expect(ProductService.update(owner, otherProduct.id, input)).rejects.toMatchObject({ status: 409 });
  });
  it("compares expected stock after expiry and reconciles legacy openings on target edits", async () => {
    const p = await create(), r = await ReservationService.create(customer, p.id, 2);
    await db.reservation.update({ where: { id: r.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(ProductService.update(owner, p.id, { stock: 5, expectedStock: 8, stockAdjustmentKey: randomUUID() })).rejects.toMatchObject({ status: 409 });
    // The rejected transaction rolls back expiry too; the next accepted request reconciles it.
    await ProductService.update(owner, p.id, { stock: 5, expectedStock: 10, stockAdjustmentKey: randomUUID() });
    expect(await balance(p.id)).toEqual({ available: 5, reserved: 0, completed: 0 });
    const legacy = await db.product.create({ data: { storeId: store.id, categoryId, name: tag, imageUrl: "/images/rice.jpg", price: 5000, stock: 20, reservable: false } });
    await ProductService.update(owner, legacy.id, { stock: 15, expectedStock: 20, stockAdjustmentKey: randomUUID() });
    expect(await ledger(legacy.id)).toBe(15);
    expect(await db.inventoryMovement.count({ where: { productId: legacy.id, reason: "RECONCILED_LEGACY_AVAILABLE" } })).toBe(1);
  });
  it("validates complete target metadata and never repairs a corrupted opened ledger", async () => {
    const p = await create();
    for (const input of [
      { stock: -1, expectedStock: 10, stockAdjustmentKey: randomUUID() },
      { stock: 1.5, expectedStock: 10, stockAdjustmentKey: randomUUID() },
      { stock: 1_000_001, expectedStock: 10, stockAdjustmentKey: randomUUID() },
      { stock: 5, expectedStock: 10 },
      { stock: 5, stockAdjustmentKey: randomUUID() },
      { expectedStock: 10, stockAdjustmentKey: randomUUID() },
      { stock: 5, expectedStock: 10, stockAdjustmentKey: "" },
      { stock: "5", expectedStock: 10, stockAdjustmentKey: randomUUID() },
    ]) await expect(ProductService.update(owner, p.id, input)).rejects.toThrow();
    expect((await balance(p.id)).available).toBe(10);
    await db.inventoryMovement.create({ data: { productId: p.id, reason: "invalid-fixture", delta: 1 } });
    await expect(ProductService.update(owner, p.id, { stock: 5, expectedStock: 10, stockAdjustmentKey: randomUUID() })).rejects.toMatchObject({ status: 409 });
    expect((await balance(p.id)).available).toBe(10);
  });
  it("concurrent target edits compare one observed balance and same-key cross-product races choose one target", async () => {
    const p = await create();
    const outcomes = await Promise.allSettled([
      ProductService.update(owner, p.id, { stock: 5, expectedStock: 10, stockAdjustmentKey: randomUUID() }),
      ProductService.update(owner, p.id, { stock: 6, expectedStock: 10, stockAdjustmentKey: randomUUID() }),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((outcomes.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect(await ledger(p.id)).toBe((await balance(p.id)).available);
    const a = await create(), b = await create(), key = randomUUID();
    const targets = await Promise.allSettled([a, b].map((product) => ProductService.update(owner, product.id, { stock: 5, expectedStock: 10, stockAdjustmentKey: key })));
    expect(targets.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((targets.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect((await balance(a.id)).available! + (await balance(b.id)).available!).toBe(15);
  });
  it("a stock target racing a booking never overwrites the reserved debit", async () => {
    const p = await create(10);
    const [target, booking] = await Promise.allSettled([
      ProductService.update(owner, p.id, { stock: 5, expectedStock: 10, stockAdjustmentKey: randomUUID() }),
      ReservationService.create(customer, p.id, 2),
    ]);
    expect(booking.status).toBe("fulfilled");
    expect(await balance(p.id)).toEqual({ available: target.status === "fulfilled" ? 3 : 8, reserved: 2, completed: 0 });
    if (target.status === "rejected") expect(target.reason).toMatchObject({ status: 409 });
    expect(await ledger(p.id)).toBe((await balance(p.id)).available);
  });
  it("keeps zero tracking retry bindings after later mode changes and scopes request identities to actors", async () => {
    const p = await create(0);
    await ProductService.update(owner, p.id, { reservable: false });
    const disable = { stock: null, expectedStock: 0, stockAdjustmentKey: randomUUID() };
    await ProductService.update(owner, p.id, disable);
    await ProductService.update(owner, p.id, { stock: 5, expectedStock: null, stockAdjustmentKey: randomUUID() });
    expect((await ProductService.update(owner, p.id, disable)).stock).toBe(5);
    expect(await db.inventoryMovement.count({ where: { productId: p.id, reason: { startsWith: "MANAGEMENT_DISABLED" } } })).toBe(1);
    const key = randomUUID();
    const ownerInput = { stock: 4, expectedStock: 5, stockAdjustmentKey: key };
    await ProductService.update(owner, p.id, ownerInput);
    await ProductService.update(admin, p.id, { stock: 7, expectedStock: 4, stockAdjustmentKey: key });
    expect((await ProductService.update(owner, p.id, ownerInput)).stock).toBe(7);
    expect(await ledger(p.id)).toBe(7);
  });
  it("creates explicit no-tracking and tracked zero without conflating them or accepting invalid numbers", async () => {
    const input = { storeId: store.id, name: tag, imageUrl: "/images/rice.jpg", categoryId, price: 5000, reservable: false };
    const untracked = await ProductService.create(owner, { ...input, stock: null });
    const zero = await ProductService.create(owner, { ...input, stock: 0 });
    expect(await InventoryService.summary(owner, untracked.id)).toMatchObject({ available: null });
    expect(await InventoryService.summary(owner, zero.id)).toMatchObject({ available: 0 });
    expect(await db.inventoryMovement.count({ where: { productId: untracked.id } })).toBe(0);
    expect(await db.inventoryMovement.count({ where: { productId: zero.id, reason: "INITIAL", delta: 0 } })).toBe(1);
    for (const stock of ["", "100", -1, 1.5, 1_000_001])
      await expect(ProductService.create(owner, { ...input, stock })).rejects.toThrow();
    await expect(ProductService.create(owner, { ...input, stock: null, reservable: true })).rejects.toThrow();
    await expect(ReservationService.create(customer, zero.id, 1)).rejects.toThrow();
  });
  it("edits stale market-linked content without silently relisting it or allowing new reservations", async () => {
    const market = await db.marketVenue.create({ data: { name: tag, slug: `${tag}-ended` } });
    try {
      const session = await db.marketSession.create({ data: { marketId: market.id, date: "2026-01-01", startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: new Date("2026-01-01T01:00:00Z") } });
      const p = await create();
      await db.product.update({ where: { id: p.id }, data: { sessionId: session.id } });
      const edited = await ProductService.update(owner, p.id, { name: "ชื่อใหม่หลังจบตลาด", price: 6000 });
      expect(edited).toMatchObject({ name: "ชื่อใหม่หลังจบตลาด", price: 6000, sessionId: session.id, stock: 10 });
      await expect(ReservationService.create(customer, p.id, 1)).rejects.toThrow();
      await ProductService.update(owner, p.id, { published: false });
      await expect(ProductService.update(owner, p.id, { published: true })).rejects.toThrow();
      await expect(ProductService.update(owner, p.id, { pickupEnd: new Date(Date.now() + 7200_000).toISOString() })).rejects.toThrow();
      await ProductService.update(owner, p.id, { sessionId: null, published: true });
      expect((await db.product.findUniqueOrThrow({where:{id:p.id}})).sessionId).toBeNull();
    } finally {
      await db.product.updateMany({ where: { storeId: store.id, session: { marketId: market.id } }, data: { sessionId: null } });
      await db.marketSession.deleteMany({ where: { marketId: market.id } });
      await db.marketVenue.delete({ where: { id: market.id } });
    }
  });
  it("records opening INITIAL so new managed stock is fully represented in its ledger", async () => {
    const p = await create();
    expect(await balance(p.id)).toEqual({ available: 10, reserved: 0, completed: 0 });
    expect(await ledger(p.id)).toBe(10);
    expect(await db.inventoryMovement.count({ where: { productId: p.id, reason: "INITIAL", delta: 10 } })).toBe(1);
  });
  it("allows full-form name/price edits with unchanged stock while preserving reserved units", async () => {
    const p = await create();
    await ReservationService.create(customer, p.id, 2);
    const edited = await ProductService.update(owner, p.id, { name: "ชื่อใหม่", price: 5500, stock: 8, reservable: true });
    expect(edited).toMatchObject({ stock: 8, name: "ชื่อใหม่", price: 5500 });
    expect(await balance(p.id)).toEqual({ available: 8, reserved: 2, completed: 0 });
    expect(await db.inventoryMovement.count({ where: { productId: p.id, delta: 0 } })).toBe(0);
  });
  it("a partial edit never injects defaults into omitted mode, visibility, reservation or description fields", async () => {
    const p = await create();
    await db.product.update({ where: { id: p.id }, data: { mode: "DISCOUNT", published: false, archived: true, description: "keep existing copy" } });
    const edited = await ProductService.update(owner, p.id, { name: "แก้ชื่อเท่านั้น" });
    expect(edited).toMatchObject({ name: "แก้ชื่อเท่านั้น", mode: "DISCOUNT", published: false, archived: true, reservable: true, stock: 10, description: "keep existing copy" });
  });
  it("reconciles expired reservations before editing and does not overwrite the released stock from a stale unchanged form", async () => {
    const p = await create();
    const r = await ReservationService.create(customer, p.id, 2);
    await db.reservation.update({ where: { id: r.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const edited = await ProductService.update(owner, p.id, { name: "แก้ไขหลังหมดอายุ", stock: 8 });
    expect(edited.stock).toBe(10);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("EXPIRED");
    await ReservationService.expire();
    expect(await balance(p.id)).toEqual({ available: 10, reserved: 0, completed: 0 });
    expect(await ledger(p.id)).toBe(10);
  });
  it("reserve2 and complete gives8/0/2 and repeated completion never debits again", async () => {
    const p = await create();
    const r = await ReservationService.create(customer, p.id, 2);
    expect(await balance(p.id)).toEqual({ available: 8, reserved: 2, completed: 0 });
    await ReservationService.transition(owner, r.id, "COMPLETED", r.pickupCode);
    await expect(ReservationService.transition(owner, r.id, "COMPLETED", r.pickupCode)).rejects.toThrow();
    expect(await balance(p.id)).toEqual({ available: 8, reserved: 0, completed: 2 });
  });
  it("cancel2 restores10/0/0 exactly once, including simultaneous retries", async () => {
    const p = await create();
    const r = await ReservationService.create(customer, p.id, 2);
    const results = await Promise.allSettled([ReservationService.transition(customer, r.id, "CANCELLED"), ReservationService.transition(customer, r.id, "CANCELLED")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await balance(p.id)).toEqual({ available: 10, reserved: 0, completed: 0 });
    expect(await db.inventoryMovement.count({ where: { reservationId: r.id, delta: 2 } })).toBe(1);
  });
  it("reservation request retries reuse one booking, preserve stock and bind the original payload", async () => {
    const p = await create(), key = randomUUID();
    const [first, replay] = await Promise.all([
      ReservationService.create(customer, p.id, 2, key),
      ReservationService.create(customer, p.id, 2, key),
    ]);
    expect(first.id).toBe(replay.id);
    expect(await balance(p.id)).toEqual({available:8,reserved:2,completed:0});
    await expect(ReservationService.create(customer, p.id, 3, key)).rejects.toMatchObject({status:409});
    const otherProduct = await create();
    await expect(ReservationService.create(customer, otherProduct.id, 2, key)).rejects.toMatchObject({status:409});
    await ReservationService.transition(customer, first.id, "CANCELLED");
    const cancelled = await ReservationService.create(customer, p.id, 2, key);
    expect(cancelled).toMatchObject({id:first.id,status:"CANCELLED"});
    expect(await balance(p.id)).toEqual({available:10,reserved:0,completed:0});
  });
  it("concurrent reservations of the final unit produce exactly one success", async () => {
    const p = await create(1);
    const results = await Promise.allSettled([ReservationService.create(customer, p.id, 1), ReservationService.create(other, p.id, 1)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ status: 409, message: "สินค้าไม่พอ กรุณาเลือกจำนวนใหม่" });
    expect(await balance(p.id)).toEqual({ available: 0, reserved: 1, completed: 0 });
  });
  it("blocks cross-owner edits and unsafe stock-management/window edits with active reservations", async () => {
    const p = await create();
    await ReservationService.create(customer, p.id, 2);
    await expect(ProductService.update(other, p.id, { name: "intruder" })).rejects.toThrow();
    await expect(ProductService.update(owner, p.id, { reservable: false })).rejects.toThrow();
    await expect(ProductService.update(owner, p.id, { stock: 9 })).rejects.toThrow();
    await expect(ProductService.update(owner, p.id, { pickupEnd: new Date(Date.now() + 7200_000).toISOString() })).rejects.toThrow();
    expect(await balance(p.id)).toEqual({ available: 8, reserved: 2, completed: 0 });
  });
  it("rejects stale absolute stock writes after cancellation or completed pickup; adjustments must use deltas", async () => {
    const p = await create();
    const r = await ReservationService.create(customer, p.id, 2);
    await ReservationService.transition(customer, r.id, "CANCELLED");
    await expect(ProductService.update(owner, p.id, { name: "stale form", stock: 8 })).rejects.toMatchObject({ status: 409 });
    expect((await balance(p.id)).available).toBe(10);
    await InventoryService.adjust(owner, p.id, {operation:"add",quantity:5,idempotencyKey:randomUUID()});
    const collected = await ReservationService.create(customer, p.id, 1);
    await ReservationService.transition(owner, collected.id, "COMPLETED", collected.pickupCode);
    await expect(ProductService.update(owner, p.id, { stock: 15 })).rejects.toMatchObject({ status: 409 });
    expect(await balance(p.id)).toEqual({available:14,reserved:0,completed:1});
  });
  it("duplicates to an unpublished display-only draft without cloning stock, orders or movement history", async () => {
    const p = await create();
    await ReservationService.create(customer, p.id, 2);
    const copy = await ProductService.duplicate(owner, p.id);
    expect(copy).toMatchObject({ published: false, reservable: false, stock: null });
    expect(await db.reservation.count({ where: { productId: copy.id } })).toBe(0);
    expect(await db.inventoryMovement.count({ where: { productId: copy.id } })).toBe(0);
  });
  it("restocks available only, returns authoritative counters, and makes concurrent same-key retries idempotent", async () => {
    const p = await create();
    const complete = await ReservationService.create(customer, p.id, 2);
    await ReservationService.transition(owner, complete.id, "COMPLETED", complete.pickupCode);
    await ReservationService.create(customer, p.id, 2);
    const input = { operation: "add", quantity: 5, idempotencyKey: randomUUID() };
    const [a, b] = await Promise.all([InventoryService.adjust(owner, p.id, input), InventoryService.adjust(owner, p.id, input)]);
    expect(a).toMatchObject({ available: 11, reserved: 2, completed: 2, product: { stock: 11 } });
    expect(b).toMatchObject({ available: 11, reserved: 2, completed: 2 });
    expect(await ledger(p.id)).toBe(11);
  });
  it("validates adjustment payload, ownership, target/key binding, capacity, and available-only removals", async () => {
    const p = await create();
    const key = randomUUID();
    await expect(InventoryService.adjust(other, p.id, { operation: "add", quantity: 5, idempotencyKey: key })).rejects.toThrow();
    for (const input of [{ operation: "add", quantity: 0, idempotencyKey: key }, { operation: "add", quantity: 1.5, idempotencyKey: key }, { operation: "remove", quantity: 11, idempotencyKey: key }, { operation: "sold-out", quantity: 1, idempotencyKey: key }, { operation: "add", quantity: 1, idempotencyKey: "x".repeat(129) }]) await expect(InventoryService.adjust(owner, p.id, input)).rejects.toThrow();
    await InventoryService.adjust(owner, p.id, { operation: "add", quantity: 5, idempotencyKey: key });
    await expect(InventoryService.adjust(owner, p.id, { operation: "add", quantity: 6, idempotencyKey: key })).rejects.toThrow();
    const otherProduct = await create();
    await expect(InventoryService.adjust(owner, otherProduct.id, { operation: "add", quantity: 5, idempotencyKey: key })).rejects.toThrow();
    const maximum = await create(1_000_000);
    await expect(InventoryService.adjust(owner, maximum.id, { operation: "add", quantity: 1, idempotencyKey: randomUUID() })).rejects.toThrow();
    expect((await balance(p.id)).available).toBe(15);
  });
  it("remove/sold-out affect available only; admin can adjust; display-only has no fake available count", async () => {
    const p = await create();
    await ReservationService.create(customer, p.id, 2);
    await InventoryService.adjust(owner, p.id, { operation: "remove", quantity: 3, idempotencyKey: randomUUID() });
    const empty = await InventoryService.adjust(admin, p.id, { operation: "sold-out", idempotencyKey: randomUUID() });
    expect(empty).toMatchObject({ available: 0, reserved: 2, completed: 0 });
    expect(await ledger(p.id)).toBe(0);
    const draft = await ProductService.duplicate(owner, p.id);
    expect(await InventoryService.summary(owner, draft.id)).toMatchObject({ available: null, reserved: 0, completed: 0 });
    await expect(InventoryService.adjust(owner, draft.id, { operation: "add", quantity: 1, idempotencyKey: randomUUID() })).rejects.toThrow();
  });
  it("same-key requests racing different products bind to exactly one target", async () => {
    const a = await create(), b = await create(), key = randomUUID();
    const results = await Promise.allSettled([InventoryService.adjust(owner, a.id, { operation: "add", quantity: 2, idempotencyKey: key }), InventoryService.adjust(owner, b.id, { operation: "add", quantity: 2, idempotencyKey: key })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect((await balance(a.id)).available! + (await balance(b.id)).available!).toBe(22);
  });
  it("delta restock expires stale reservations first, returns units once, and replays the current balance", async () => {
    const p = await create(), key = randomUUID();
    const r = await ReservationService.create(customer, p.id, 2);
    await db.reservation.update({ where: { id: r.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await InventoryService.adjust(owner, p.id, { operation: "add", quantity: 5, idempotencyKey: key })).toMatchObject({ available: 15, reserved: 0, completed: 0 });
    await ReservationService.create(customer, p.id, 1);
    expect(await InventoryService.adjust(owner, p.id, { operation: "add", quantity: 5, idempotencyKey: key })).toMatchObject({ available: 14, reserved: 1, completed: 0 });
    expect(await db.inventoryMovement.count({ where: { reservationId: r.id, delta: 2 } })).toBe(1);
    expect(await ledger(p.id)).toBe(14);
  });
  it("reconciles a legacy missing-opening ledger exactly once, locally on its first adjustment", async () => {
    const legacy = await db.product.create({ data: { storeId: store.id, categoryId, name: tag, imageUrl: "/images/rice.jpg", price: 5000, stock: 10, reservable: true, pickupStart: new Date(Date.now() - 60_000), pickupEnd: new Date(Date.now() + 3600_000) } });
    await ReservationService.create(customer, legacy.id, 2);
    expect(await ledger(legacy.id)).toBe(-2);
    await InventoryService.adjust(owner, legacy.id, { operation: "add", quantity: 5, idempotencyKey: randomUUID() });
    await InventoryService.adjust(owner, legacy.id, { operation: "add", quantity: 1, idempotencyKey: randomUUID() });
    expect(await ledger(legacy.id)).toBe(14);
    expect(await db.inventoryMovement.count({ where: { productId: legacy.id, reason: "RECONCILED_LEGACY_AVAILABLE" } })).toBe(1);
  });
  it("product archive is owner-authorized, audited once, and preserves reservations, stock and movements", async () => {
    const p = await create();
    const completed = await ReservationService.create(customer, p.id, 2);
    await ReservationService.transition(owner, completed.id, "COMPLETED", completed.pickupCode);
    const active = await ReservationService.create(customer, p.id, 2);
    const movements = await db.inventoryMovement.findMany({ where: { productId: p.id }, orderBy: { id: "asc" } });
    await expect(ProductService.archive(other, p.id)).rejects.toThrow();
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).archived).toBe(false);
    const [first, second] = await Promise.all([ProductService.archive(owner, p.id), ProductService.archive(owner, p.id)]);
    expect(first).toMatchObject({ archived: true, published: false, stock: 6, imageUrl: p.imageUrl });
    expect(second).toEqual(first);
    expect(await balance(p.id)).toEqual({ available: 6, reserved: 2, completed: 2 });
    expect(await db.inventoryMovement.findMany({ where: { productId: p.id }, orderBy: { id: "asc" } })).toEqual(movements);
    expect(await db.reservation.findUnique({ where: { id: active.id } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { actorId: owner.id, action: "PRODUCT_ARCHIVED", target: p.id } })).toBe(1);
    await expect(ReservationService.create(customer, p.id, 1)).rejects.toThrow();
  });
  it("store photo association clears with null without deleting uploaded image metadata; non-owned updates fail", async () => {
    const upload = await db.upload.create({ data: { userId: owner.id, key: `staging/${tag}/kept`, approvedKey: `approved/${tag}/kept.jpg`, mime: "image/jpeg", size: 500, status: "APPROVED" } });
    await db.store.update({ where: { id: store.id }, data: { imageUrl: "/images/rice.jpg" } });
    await expect(StoreService.update(other, store.id, { imageUrl: null })).rejects.toThrow();
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).imageUrl).toBe("/images/rice.jpg");
    expect(await StoreService.update(owner, store.id, { imageUrl: null })).toMatchObject({ imageUrl: null });
    expect(await db.upload.findUnique({ where: { id: upload.id } })).not.toBeNull();
    await expect(StoreService.update(owner, store.id, { imageUrl: "https://foreign.example.invalid/image.jpg" })).rejects.toThrow();
  });
  it("store archive hides/closes only the authorized store, records one audit and preserves products/history/images", async () => {
    const p = await create();
    const r = await ReservationService.create(customer, p.id, 2);
    await db.store.update({ where: { id: store.id }, data: { imageUrl: "/images/rice.jpg" } });
    const productCount = await db.product.count({ where: { storeId: store.id } });
    await expect(StoreService.archive(other, store.id)).rejects.toThrow();
    const first = await StoreService.archive(owner, store.id);
    const second = await StoreService.archive(owner, store.id);
    expect(first).toMatchObject({ hidden: true, open: false, imageUrl: "/images/rice.jpg" });
    expect(second).toEqual(first);
    expect(await db.product.count({ where: { storeId: store.id } })).toBe(productCount);
    expect(await db.reservation.findUnique({ where: { id: r.id } })).not.toBeNull();
    expect(await ledger(p.id)).toBe(8);
    expect(await db.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { actorId: owner.id, action: "STORE_ARCHIVED", target: store.id } })).toBe(1);
    await expect(ReservationService.create(customer, p.id, 1)).rejects.toThrow();
  });

});
