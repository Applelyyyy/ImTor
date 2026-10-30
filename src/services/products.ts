import { randomUUID } from "node:crypto";
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
      imageUrl: z.string().optional(),
      kind: z.enum(["MARKET", "PERMANENT", "BOTH"]).optional(),
    });
    const data = schema.parse(input);
    const store = await db.store.findUniqueOrThrow({ where: { id } });
    assertOwner(actor, store);
    invariant(!store.suspended, "ร้านถูกระงับ", 403);
    if (data.imageUrl) await UploadService.assertOwned(actor, data.imageUrl);
    if (data.kind && data.kind !== "MARKET")
      invariant(data.address || store.address, "กรุณาระบุที่อยู่ร้าน");
    return db.store.update({ where: { id }, data });
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
    return db.product.create({
      data: {
        ...data,
        stock: data.reservable ? data.stock : null,
        pickupStart: data.pickupStart ? new Date(data.pickupStart) : null,
        pickupEnd: data.pickupEnd ? new Date(data.pickupEnd) : null,
        demoBatchId: store.demoBatchId,
      },
    });
  }
  static async validateReferences(
    actor: Actor,
    data: ReturnType<typeof productSchema.parse>,
  ) {
    await UploadService.assertOwned(actor, data.imageUrl);
    const category = await db.productCategory.findUniqueOrThrow({
      where: { id: data.categoryId },
    });
    invariant(
      data.mode !== "RESCUE" || category.food,
      "เฉพาะอาหารเท่านั้นที่เป็นรายการช่วยลดอาหารเหลือทิ้ง",
    );
    if (data.sessionId) {
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
    const patch = productFields.partial().omit({ storeId: true }).parse(input);
    return transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${id} FOR UPDATE`;
      const old = await tx.product.findUniqueOrThrow({
        where: { id },
        include: { store: true },
      });
      assertOwner(actor, old.store);
      invariant(!old.store.suspended, "ร้านถูกระงับ", 403);
      const merged = productSchema.parse({
        ...old,
        pickupStart: old.pickupStart?.toISOString(),
        pickupEnd: old.pickupEnd?.toISOString(),
        ...patch,
      });
      await this.validateReferences(actor, merged);
      const windowChanged =
        (patch.pickupStart !== undefined &&
          new Date(patch.pickupStart ?? 0).getTime() !==
            (old.pickupStart?.getTime() ?? 0)) ||
        (patch.pickupEnd !== undefined &&
          new Date(patch.pickupEnd ?? 0).getTime() !==
            (old.pickupEnd?.getTime() ?? 0)) ||
        (patch.sessionId !== undefined && patch.sessionId !== old.sessionId);
      if (
        patch.reservable === false ||
        patch.stock !== undefined ||
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
      if (patch.stock !== undefined)
        await tx.inventoryMovement.create({
          data: {
            productId: id,
            delta: (patch.stock ?? 0) - (old.stock ?? 0),
            reason: "ADJUSTED",
          },
        });
      return tx.product.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.reservable === false ? { stock: null } : {}),
          pickupStart: merged.pickupStart ? new Date(merged.pickupStart) : null,
          pickupEnd: merged.pickupEnd ? new Date(merged.pickupEnd) : null,
        },
      });
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
