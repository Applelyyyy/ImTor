import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, type Product } from "@/generated/prisma/client";
import { assertOwner, type Actor } from "@/lib/permissions";
import { invariant } from "@/lib/errors";
import { transaction } from "./transactions";

export const adjustmentKey = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const quantity = z.number().int().min(1).max(1_000_000);
export const inventoryAdjustmentSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("add"), quantity, idempotencyKey: adjustmentKey }).strict(),
  z.object({ operation: z.literal("remove"), quantity, idempotencyKey: adjustmentKey }).strict(),
  z.object({ operation: z.literal("sold-out"), idempotencyKey: adjustmentKey }).strict(),
]);
export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;
export type InventorySummary = { product: Product; available: number | null; reserved: number; completed: number };

/** Caller holds the Product row lock and has reconciled expiry. Quantities are units, not order counts. */
export async function inventorySummary(tx: Prisma.TransactionClient, productId: string): Promise<InventorySummary> {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  const groups = await tx.reservation.groupBy({ by: ["status"], where: { productId, status: { in: ["RESERVED", "COMPLETED"] } }, _sum: { quantity: true } });
  return {
    product,
    available: product.stock,
    reserved: groups.find((group) => group.status === "RESERVED")?._sum.quantity ?? 0,
    completed: groups.find((group) => group.status === "COMPLETED")?._sum.quantity ?? 0,
  };
}

export class InventoryService {
  static async summary(actor: Actor, productId: string): Promise<InventorySummary> {
    z.string().min(1).max(100).parse(productId);
    return transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} FOR UPDATE`;
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, include: { store: true } });
      assertOwner(actor, product.store);
      invariant(!product.store.suspended, "ร้านถูกระงับ", 403);
      await this.expireForProduct(tx, productId);
      return inventorySummary(tx, productId);
    });
  }

  /** Adjust only unreserved availability. Replays return current authoritative totals, not a stale snapshot. */
  static async adjust(actor: Actor, productId: string, input: unknown): Promise<InventorySummary> {
    z.string().min(1).max(100).parse(productId);
    const data = inventoryAdjustmentSchema.parse(input);
    const work = () => transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} FOR UPDATE`;
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, include: { store: true } });
      assertOwner(actor, product.store);
      invariant(!product.store.suspended, "ร้านถูกระงับ", 403);
      const prefix = product.demoBatchId ? `${product.demoBatchId}:` : "";
      const fingerprint = createHash("sha256").update(JSON.stringify([actor.id, data.idempotencyKey])).digest("hex");
      const movementId = `${prefix}adjust:${fingerprint}`;
      const reason = `ADJUSTED:${data.operation}:${"quantity" in data ? data.quantity : "all"}`;
      const previous = await tx.inventoryMovement.findUnique({ where: { id: movementId } });
      if (previous) {
        invariant(previous.productId === productId && previous.reason === reason, "คำขอเดิมมีสินค้าหรือจำนวนต่างกัน กรุณาเริ่มคำขอใหม่", 409);
        await this.expireForProduct(tx, productId);
        return inventorySummary(tx, productId);
      }
      invariant(product.stock !== null, "สินค้านี้เป็นรายการแสดงอย่างเดียว ไม่ได้จัดการจำนวน", 409);
      await this.expireForProduct(tx, productId);
      const current = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const available = current.stock!;
      const delta = data.operation === "sold-out" ? -available : data.operation === "add" ? data.quantity : -data.quantity;
      invariant(available + delta >= 0, "ลดจำนวนเกินสินค้าที่คงเหลือไม่ได้", 409);
      invariant(available + delta <= 1_000_000, "จำนวนสินค้าต้องไม่เกิน 1,000,000", 409);
      const legacyReconciled = await this.reconcileLedger(tx, current);
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } });
      await tx.inventoryMovement.create({ data: { id: movementId, productId, delta, reason } });
      await tx.auditLog.create({ data: { ...(product.demoBatchId ? { id: `${movementId}:audit` } : {}), actorId: actor.id, action: "INVENTORY_ADJUSTED", target: productId, changes: { operation: data.operation, delta, available: available + delta, legacyReconciled } } });
      return inventorySummary(tx, productId);
    });
    try { return await work(); }
    catch (error) {
      // Two different product locks may race the same actor/key primary key.
      // Retry once to inspect the winning binding; never apply a second delta.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return work();
      throw error;
    }
  }

  /** A caller must hold the product lock and reconcile expiry before invoking this. */
  static async reconcileLedger(tx: Prisma.TransactionClient, product: Product) {
    const opening = await tx.inventoryMovement.findFirst({ where: { productId: product.id, OR: [
      { reason: { in: ["INITIAL", "DEMO_OPENING", "RECONCILED_LEGACY_AVAILABLE"] } },
      { reason: { startsWith: "MANAGEMENT_ENABLED" } },
    ] }, select: { id: true } });
    const sum = (await tx.inventoryMovement.aggregate({ where: { productId: product.id }, _sum: { delta: true } }))._sum.delta ?? 0;
    if (!opening && product.stock !== null) {
      // Anchor legacy availability once, preserving reservation/sales history.
      const prefix = product.demoBatchId ? `${product.demoBatchId}:` : "";
      await tx.inventoryMovement.create({ data: { id: `${prefix}legacy-opening:${product.id}`, productId: product.id, delta: product.stock - sum, reason: "RECONCILED_LEGACY_AVAILABLE" } });
      return true;
    }
    invariant(sum === (product.stock ?? 0), "ประวัติจำนวนสินค้าไม่ตรงกับยอดคงเหลือ กรุณาตรวจสอบก่อนปรับจำนวน", 409);
    return false;
  }

  /** Atomic available-balance target edit. Replay returns the latest balance, never reapplies a delta. */
  static async target(
    tx: Prisma.TransactionClient,
    actor: Actor,
    product: Product,
    input: { stock: number | null; expectedStock: number | null; stockAdjustmentKey: string },
  ): Promise<number | null> {
    const prefix = product.demoBatchId ? `${product.demoBatchId}:` : "";
    const fingerprint = createHash("sha256").update(JSON.stringify([actor.id, input.stockAdjustmentKey])).digest("hex");
    const movementId = `${prefix}target:${fingerprint}`;
    const binding = JSON.stringify([input.expectedStock, input.stock]);
    const prior = await tx.inventoryMovement.findUnique({ where: { id: movementId } });
    if (prior) {
      invariant(prior.productId === product.id && prior.reason.endsWith(`:${binding}`), "คำขอเดิมมีสินค้าหรือจำนวนต่างกัน กรุณาเริ่มคำขอใหม่", 409);
      return product.stock;
    }
    invariant(product.stock === input.expectedStock, "จำนวนสินค้าเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไข", 409);
    if (input.stock === null && product.stock !== null) {
      const reserved = await tx.reservation.count({ where: { productId: product.id, status: "RESERVED" } });
      invariant(!reserved, "ยังมีการจองอยู่ กรุณาจัดการการจองก่อนปิดการติดตามจำนวน", 409);
    }
    const legacyReconciled = await this.reconcileLedger(tx, product);
    const delta = (input.stock ?? 0) - (product.stock ?? 0);
    const reason = product.stock === null && input.stock !== null ? "MANAGEMENT_ENABLED" : product.stock !== null && input.stock === null ? "MANAGEMENT_DISABLED" : "ADJUSTED_TARGET";
    await tx.product.update({ where: { id: product.id }, data: { stock: input.stock } });
    // Zero transitions and no-op requests still persist a retry binding.
    await tx.inventoryMovement.create({ data: { id: movementId, productId: product.id, delta, reason: `${reason}:${binding}` } });
    await tx.auditLog.create({ data: { ...(product.demoBatchId ? { id: `${movementId}:audit` } : {}), actorId: actor.id, action: "INVENTORY_ADJUSTED", target: product.id, changes: { operation: "target", before: product.stock, available: input.stock, delta, legacyReconciled } } });
    return input.stock;
  }

  static async expireForProduct(
    tx: Prisma.TransactionClient,
    productId: string,
    now = new Date(),
  ) {
    const expired = await tx.reservation.findMany({
      where: { productId, status: "RESERVED", expiresAt: { lte: now } },
    });
    for (const row of expired) {
      const changed = await tx.reservation.updateMany({
        where: { id: row.id, status: "RESERVED" },
        data: { status: "EXPIRED" },
      });
      if (changed.count) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: row.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId,
            reservationId: row.id,
            delta: row.quantity,
            reason: "EXPIRED",
          },
        });
      }
    }
  }
}
