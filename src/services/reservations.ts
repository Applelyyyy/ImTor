import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { assertActive, assertOwner, type Actor } from "@/lib/permissions";
import { transaction } from "./transactions";
import { InventoryService } from "./inventory";
import { PricingService } from "./pricing";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { reservationSchema } from "@/lib/validation";
export class ReservationService {
  static async create(actor: Actor, productId: string, quantity: number, idempotencyKey?: string) {
    assertActive(actor);
    reservationSchema.parse({ productId, quantity });
    if (idempotencyKey !== undefined) z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/).parse(idempotencyKey);
    const movementId = idempotencyKey === undefined ? undefined : `reservation-request:${createHash("sha256").update(JSON.stringify([actor.id, idempotencyKey])).digest("hex")}`;
    const work = () => transaction(async (tx) => {
      const now = new Date();
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} FOR UPDATE`;
      await InventoryService.expireForProduct(tx, productId, now);
      if (movementId) {
        const previous = await tx.inventoryMovement.findUnique({where:{id:movementId},include:{reservation:true}});
        if (previous) {
          invariant(previous.productId === productId && previous.reservation?.userId === actor.id && previous.reservation.quantity === quantity,
            "คำขอจองเดิมมีสินค้าหรือจำนวนต่างกัน กรุณาตรวจสอบการจองของคุณ", 409);
          return previous.reservation;
        }
      }
      const p = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { store: true, discounts: true, session: true },
      });
      invariant(
        p.published &&
          !p.archived &&
          !p.store.suspended &&
          !p.store.hidden &&
          p.reservable,
        "สินค้านี้ไม่เปิดให้จอง",
        409,
      );
      invariant(!p.demoBatchId, "สินค้าสาธิตไม่รับการจองจริง", 409);
      const settings = await tx.systemSetting.findMany({
        where: { key: { in: ["reservationsEnabled", "foodRescueEnabled"] } },
      });
      invariant(
        !settings.some(
          (s) => s.key === "reservationsEnabled" && s.value === false,
        ),
        "ระบบจองปิดชั่วคราว",
        409,
      );
      invariant(
        p.mode !== "RESCUE" ||
          !settings.some(
            (s) => s.key === "foodRescueEnabled" && s.value === false,
          ),
        "ระบบอาหารเหลือทิ้งปิดชั่วคราว",
        409,
      );
      invariant(
        p.pickupEnd &&
          p.pickupEnd > now &&
          p.pickupStart &&
          p.pickupStart < p.pickupEnd,
        "หมดเวลารับสินค้าแล้ว",
        409,
      );
      if (p.session)
        invariant(
          p.session.status !== "CANCELLED" && p.session.endsAt > now,
          "ตลาดรอบนี้จบแล้ว",
          409,
        );
      const updated = await tx.product.updateMany({
        where: { id: p.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      invariant(updated.count === 1, "สินค้าไม่พอ กรุณาเลือกจำนวนใหม่", 409);
      const defaults =
        p.mode === "REGULAR"
          ? []
          : await tx.discountRule.findMany({ where: { productId: null } });
      const price = PricingService.calculate(
        p.price,
        p.mode === "REGULAR" ? [] : [...p.discounts, ...defaults],
        now,
      );
      const expiresAt = new Date(
        Math.min(
          p.pickupEnd.getTime(),
          p.session?.endsAt.getTime() ?? Infinity,
        ),
      );
      const reservation = await tx.reservation.create({
        data: {
          userId: actor.id,
          productId,
          quantity,
          unitPrice: price.current,
          originalPrice: p.price,
          productMode: p.mode,
          pickupCode: randomBytes(8).toString("hex").toUpperCase(),
          expiresAt,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          ...(movementId ? { id: movementId } : {}),
          productId,
          reservationId: reservation.id,
          delta: -quantity,
          reason: "RESERVED",
        },
      });
      return reservation;
    });
    try { return await work(); }
    catch (error) {
      // Different product locks can race the same request key. Read its winning
      // binding after rollback rather than applying a second decrement.
      if (movementId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return work();
      throw error;
    }
  }
  static async transition(
    actor: Actor,
    id: string,
    status: string,
    pickupCode?: string,
  ) {
    assertActive(actor);
    invariant(
      ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status),
      "สถานะไม่ถูกต้อง",
    );
    const existing = await db.reservation.findUniqueOrThrow({ where: { id } });
    return transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${existing.productId} FOR UPDATE`;
      const r = await tx.reservation.findUniqueOrThrow({
        where: { id },
        include: { product: { include: { store: true } } },
      });
      invariant(r.status === "RESERVED", "การจองนี้เปลี่ยนสถานะแล้ว", 409);
      if (status === "CANCELLED")
        invariant(
          r.userId === actor.id ||
            r.product.store.ownerId === actor.id ||
            ["ADMIN", "SUPERADMIN"].includes(actor.role),
          "ไม่มีสิทธิ์",
          403,
        );
      else assertOwner(actor, r.product.store);
      if (status === "COMPLETED") {
        invariant(r.expiresAt > new Date(), "การจองหมดอายุแล้ว", 409);
        invariant(
          !!r.product.pickupStart && r.product.pickupStart <= new Date(),
          "ยังไม่ถึงเวลารับสินค้า",
          409,
        );
        const actual = Buffer.from(r.pickupCode),
          provided = Buffer.from(pickupCode ?? "");
        invariant(
          actual.length === provided.length &&
            timingSafeEqual(actual, provided),
          "รหัสรับสินค้าไม่ถูกต้อง",
          400,
        );
      }
      if (status === "NO_SHOW")
        invariant(r.expiresAt <= new Date(), "ยังไม่หมดเวลารับสินค้า", 409);
      const result = await tx.reservation.update({
        where: { id },
        data: {
          status,
          completedAt: status === "COMPLETED" ? new Date() : null,
        },
      });
      if (status !== "COMPLETED") {
        await tx.product.update({
          where: { id: r.productId },
          data: { stock: { increment: r.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: r.productId,
            reservationId: id,
            delta: r.quantity,
            reason: status,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "RESERVATION_" + status,
          target: id,
        },
      });
      return result;
    });
  }
  static async expire() {
    const rows = await db.reservation.findMany({
      where: { status: "RESERVED", expiresAt: { lte: new Date() } },
      distinct: ["productId"],
      select: { productId: true },
      take: 200,
    });
    for (const row of rows)
      await transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${row.productId} FOR UPDATE`;
        await InventoryService.expireForProduct(tx, row.productId);
      });
    return rows.length;
  }
}
