import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { assertOwner, type Actor } from "@/lib/permissions";
import { invariant } from "@/lib/errors";
import {
  productSchema,
  productFields,
  storeSchema,
  discountSchema,
} from "@/lib/validation";
import { UploadService } from "./uploads";
import { transaction } from "./transactions";
import { PricingService } from "./pricing";
import { InventoryService, adjustmentKey } from "./inventory";
export class StoreService {
  static async create(actor: Actor, input: unknown) {
    const data = storeSchema.parse(input);
    if (data.imageUrl) await UploadService.assertOwned(actor, data.imageUrl);
    const settings = await db.systemSetting.findMany({
      where: {
        key: { in: ["storeRegistrationEnabled", "requireStoreApproval"] },
      },
    });
    invariant(
      !settings.some(
        (s) => s.key === "storeRegistrationEnabled" && s.value === false,
      ),
      "การสมัครร้านค้าปิดชั่วคราว",
      409,
    );
    return db.store.create({
      data: {
        ...data,
        ownerId: actor.id,
        slug: `shop-${randomUUID().slice(0, 12)}`,
        hidden: settings.some(
          (s) => s.key === "requireStoreApproval" && s.value === true,
        ),
      },
    });
  }
  static async update(actor: Actor, id: string, input: unknown) {
    const { z } = await import("zod");
    const schema = z.object({
      name: z.string().trim().min(1).max(160).optional(),
      description: z.string().max(2000).optional(),
      address: z.string().max(500).optional(),
      open: z.boolean().optional(),
      imageUrl: z.string().max(2048).nullish(),
      kind: z.enum(["MARKET", "PERMANENT", "BOTH"]).optional(),
    });
    const data = schema.parse(input);
    const store = await db.store.findUniqueOrThrow({ where: { id } });
    assertOwner(actor, store);
    invariant(!store.suspended, "ร้านถูกระงับ", 403);
    if (data.imageUrl !== undefined && data.imageUrl !== null)
      await UploadService.assertOwned(actor, data.imageUrl);
    if ((data.address !== undefined || data.kind !== undefined) && (data.kind ?? store.kind) !== "MARKET")
      invariant((data.address ?? store.address)?.trim(), "กรุณาระบุที่อยู่ร้าน");
    return db.store.update({ where: { id }, data });
  }
  /** Close and hide the store; never delete its owner, listings, images or order history. */
  static async archive(actor: Actor, id: string) {
    return transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${id} FOR UPDATE`;
      const store = await tx.store.findUniqueOrThrow({ where: { id } });
      assertOwner(actor, store);
      if (store.hidden && !store.open) return store;
      const archived = await tx.store.update({ where: { id }, data: { hidden: true, open: false } });
      await tx.auditLog.create({ data: {
        ...(store.demoBatchId ? { id: `${store.demoBatchId}:audit:store-archive:${randomUUID()}` } : {}),
        actorId: actor.id, action: "STORE_ARCHIVED", target: id,
        changes: { before: { hidden: store.hidden, open: store.open }, after: { hidden: true, open: false } },
      } });
      return archived;
    });
  }

}
export class ProductService {
  static async create(actor: Actor, input: unknown) {
    const data = productSchema.parse(input);
    const store = await db.store.findUniqueOrThrow({
      where: { id: data.storeId },
    });
    assertOwner(actor, store);
    invariant(!store.suspended, "ร้านถูกระงับ", 403);
    await this.validateReferences(actor, data);
    const settings = await db.systemSetting.findUnique({
      where: { key: "foodRescueEnabled" },
    });
    invariant(
      data.mode !== "RESCUE" || settings?.value !== false,
      "ระบบอาหารเหลือทิ้งปิดชั่วคราว",
      409,
    );
    return transaction(async (tx) => {
      const currentStore = await tx.store.findUniqueOrThrow({ where: { id: data.storeId } });
      assertOwner(actor, currentStore);
      invariant(!currentStore.suspended, "ร้านถูกระงับ", 403);
      const product = await tx.product.create({
        data: {
          ...data,
          stock: data.stock ?? null,
          pickupStart: data.pickupStart ? new Date(data.pickupStart) : null,
          pickupEnd: data.pickupEnd ? new Date(data.pickupEnd) : null,
          demoBatchId: currentStore.demoBatchId,
        },
      });
      if (product.stock !== null)
        await tx.inventoryMovement.create({ data: {
          ...(product.demoBatchId ? { id: `${product.demoBatchId}:initial:${product.id}` } : {}),
          productId: product.id, delta: product.stock!, reason: "INITIAL",
        } });
      return product;
    });
  }
  static async validateReferences(
    actor: Actor,
    data: ReturnType<typeof productSchema.parse>,
    validateSession = true,
  ) {
    await UploadService.assertOwned(actor, data.imageUrl);
    const category = await db.productCategory.findUniqueOrThrow({
      where: { id: data.categoryId },
    });
    invariant(
      data.mode !== "RESCUE" || category.food,
      "เฉพาะอาหารเท่านั้นที่เป็นรายการช่วยลดอาหารเหลือทิ้ง",
    );
    if (validateSession && data.sessionId) {
      const session = await db.marketSession.findUniqueOrThrow({
        where: { id: data.sessionId },
      });
      const attendance = await db.storeAttendance.findUnique({
        where: {
          storeId_sessionId: {
            storeId: data.storeId,
            sessionId: data.sessionId,
          },
        },
      });
      invariant(
        attendance &&
          !["CANCELLED", "NOT_ATTENDING"].includes(attendance.status) &&
          session.status !== "CANCELLED" &&
          session.endsAt > new Date(),
        "ร้านต้องเข้าร่วมรอบตลาดนี้ก่อน",
      );
    }
  }
  static async update(actor: Actor, id: string, input: unknown) {
    const parsed = productFields.partial().omit({ storeId: true }).extend({
      expectedStock: z.number().int().min(0).max(1_000_000).nullable().optional(),
      stockAdjustmentKey: adjustmentKey.optional(),
    }).parse(input);
    // Zod defaults nested inside optional fields still apply in PATCH schemas.
    // Validate submitted values, but never let omitted fields reset stored state.
    const { expectedStock, stockAdjustmentKey, ...patch } = Object.fromEntries(Object.entries(parsed).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(input, key),
    )) as typeof parsed;
    const hasTarget = expectedStock !== undefined || stockAdjustmentKey !== undefined;
    invariant(!hasTarget || (expectedStock !== undefined && stockAdjustmentKey !== undefined && patch.stock !== undefined), "การแก้จำนวนต้องมีจำนวนเดิมและรหัสคำขอครบถ้วน");
    const work = () => transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${id} FOR UPDATE`;
      const beforeExpiry = await tx.product.findUniqueOrThrow({
        where: { id },
        include: { store: true },
      });
      assertOwner(actor, beforeExpiry.store);
      invariant(!beforeExpiry.store.suspended, "ร้านถูกระงับ", 403);
      await InventoryService.expireForProduct(tx, id);
      const old = await tx.product.findUniqueOrThrow({ where: { id }, include: { store: true } });
      // Older full forms echo the old available balance even for a name-only edit.
      // Ignore that unchanged value, including when expiry just returned units.
      const effectivePatch = { ...patch };
      if (hasTarget) {
        effectivePatch.stock = await InventoryService.target(tx, actor, old, {
          stock: patch.stock!, expectedStock: expectedStock!, stockAdjustmentKey: stockAdjustmentKey!,
        });
      } else if (effectivePatch.stock !== undefined) {
        invariant(effectivePatch.stock === beforeExpiry.stock,
          "จำนวนสินค้าเปลี่ยนแล้ว กรุณาปรับจำนวนพร้อมข้อมูลล่าสุด", 409);
        delete effectivePatch.stock;
      }
      const merged = productSchema.parse({
        ...old,
        pickupStart: old.pickupStart?.toISOString(),
        pickupEnd: old.pickupEnd?.toISOString(),
        ...effectivePatch,
      });
      const windowChanged =
        (patch.pickupStart !== undefined &&
          new Date(patch.pickupStart ?? 0).getTime() !==
            (old.pickupStart?.getTime() ?? 0)) ||
        (patch.pickupEnd !== undefined &&
          new Date(patch.pickupEnd ?? 0).getTime() !==
            (old.pickupEnd?.getTime() ?? 0)) ||
        (patch.sessionId !== undefined && patch.sessionId !== old.sessionId);
      // Historical linkage must not block unrelated copy/price edits. Recheck
      // eligibility when moving pickup, re-publishing, or enabling reservations.
      await this.validateReferences(actor, merged, windowChanged ||
        (patch.published === true && !old.published) ||
        (patch.reservable === true && !old.reservable));
      if (
        (patch.reservable === false && old.reservable) ||
        (effectivePatch.stock === null && old.stock !== null) ||
        windowChanged
      ) {
        const reserved = await tx.reservation.count({
          where: { productId: id, status: "RESERVED" },
        });
        invariant(
          !reserved,
          "ยังมีการจองอยู่ กรุณาจัดการการจองก่อนแก้จำนวน สถานที่ หรือเวลารับ",
          409,
        );
      }
      return tx.product.update({
        where: { id },
        data: {
          ...effectivePatch,
          stock: merged.stock ?? null,
          pickupStart: merged.pickupStart ? new Date(merged.pickupStart) : null,
          pickupEnd: merged.pickupEnd ? new Date(merged.pickupEnd) : null,
        },
      });
    });
    try { return await work(); }
    catch (error) {
      // A key racing across two distinct product locks has a single winning binding.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return work();
      throw error;
    }
  }
  /** Soft archive preserves inventory and existing pickup/cancellation workflows. */
  static async archive(actor: Actor, id: string) {
    return transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${id} FOR UPDATE`;
      const { store, ...product } = await tx.product.findUniqueOrThrow({ where: { id }, include: { store: { select: { ownerId: true } } } });
      assertOwner(actor, store);
      if (product.archived && !product.published) return product;
      const archived = await tx.product.update({ where: { id }, data: { archived: true, published: false } });
      await tx.auditLog.create({ data: {
        ...(product.demoBatchId ? { id: `${product.demoBatchId}:audit:product-archive:${randomUUID()}` } : {}),
        actorId: actor.id, action: "PRODUCT_ARCHIVED", target: id,
        changes: { before: { archived: product.archived, published: product.published }, after: { archived: true, published: false } },
      } });
      return archived;
    });
  }
  static async duplicate(actor: Actor, id: string) {
    const p = await db.product.findUniqueOrThrow({
      where: { id },
      include: { store: true },
    });
    assertOwner(actor, p.store);
    return this.create(actor, {
      storeId: p.storeId,
      name: p.name + " (ลงขายอีกครั้ง)",
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      categoryId: p.categoryId,
      mode: "REGULAR",
      published: false,
      reservable: false,
      allergens: p.allergens,
      storage: p.storage,
    });
  }
  static async discount(actor: Actor, productId: string, input: unknown) {
    const data = discountSchema.parse(input);
    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { store: true },
    });
    assertOwner(actor, product.store);
    invariant(
      data.kind !== "FIXED" || data.value <= product.price,
      "ราคาลดต้องไม่เกินราคาปกติ",
    );
    PricingService.calculate(product.price, [data]);
    return transaction(async (tx) => {
      const rule = await tx.discountRule.create({
        data: {
          ...data,
          productId,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
        },
      });
      if (product.mode === "REGULAR")
        await tx.product.update({
          where: { id: productId },
          data: { mode: "DISCOUNT" },
        });
      return rule;
    });
  }
}
