import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { assertAdmin, type Actor } from "@/lib/permissions";
import { invariant } from "@/lib/errors";
import {
  marketSchema,
  ruleSchema,
  exceptionSchema,
  stallSchema,
} from "@/lib/validation";
import { transaction } from "./transactions";
import { MarketScheduleService } from "./schedule";
import { UploadService } from "./uploads";
async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  target: string,
  changes?: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({
    data: { actorId: actor.id, action, target, changes },
  });
}
async function resetFuture(tx: Prisma.TransactionClient, marketId: string) {
  await tx.$executeRaw`UPDATE "MarketVenue" SET timezone=timezone WHERE id=${marketId}`;
  const sessions = await tx.marketSession.findMany({
    where: { marketId, endsAt: { gt: new Date() } },
    include: { _count: { select: { attendances: true, products: true } } },
  });
  invariant(
    sessions.every(
      (s) =>
        s.status === "CANCELLED" ||
        (!s._count.attendances && !s._count.products),
    ),
    "มีร้านหรือสินค้าในรอบตลาด กรุณายกเลิกรอบที่ได้รับผลกระทบก่อนแก้ตาราง",
    409,
  );
  await tx.marketSession.deleteMany({
    where: {
      id: {
        in: sessions.filter((s) => s.status !== "CANCELLED").map((s) => s.id),
      },
    },
  });
}
export class AdminService {
  static async user(actor: Actor, id: string, input: unknown) {
    assertAdmin(actor);
    const data = z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).optional(),
        suspended: z.boolean().optional(),
      })
      .parse(input);
    return transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(91382017)`;
      const target = await tx.user.findUniqueOrThrow({ where: { id } });
      if (data.role !== undefined || target.role === "SUPERADMIN")
        invariant(
          actor.role === "SUPERADMIN",
          "เฉพาะผู้ดูแลสูงสุดเท่านั้นที่จัดการสิทธิ์ได้",
          403,
        );
      if (
        target.role === "SUPERADMIN" &&
        ((data.role && data.role !== "SUPERADMIN") || data.suspended)
      )
        invariant(
          (await tx.user.count({
            where: { role: "SUPERADMIN", suspended: false, id: { not: id } },
          })) > 0,
          "ต้องเหลือผู้ดูแลสูงสุดอย่างน้อยหนึ่งคน",
          409,
        );
      const row = await tx.user.update({ where: { id }, data });
      if (data.suspended)
        await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, actor, "USER_UPDATED", id, data);
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        suspended: row.suspended,
      };
    });
  }
  static async store(actor: Actor, id: string, input: unknown) {
    assertAdmin(actor);
    const data = z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        description: z.string().max(2000).optional(),
        verified: z.boolean().optional(),
        suspended: z.boolean().optional(),
        hidden: z.boolean().optional(),
      })
      .parse(input);
    return transaction(async (tx) => {
      const row = await tx.store.update({ where: { id }, data });
      await audit(tx, actor, "STORE_MODERATED", id, data);
      return row;
    });
  }
  static async product(actor: Actor, id: string, input: unknown) {
    assertAdmin(actor);
    const data = z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        published: z.boolean().optional(),
        archived: z.boolean().optional(),
        price: z.number().int().min(0).max(100000000).optional(),
      })
      .parse(input);
    return transaction(async (tx) => {
      const row = await tx.product.update({ where: { id }, data });
      await audit(tx, actor, "PRODUCT_MODERATED", id, data);
      return row;
    });
  }
  static async market(actor: Actor, id: string | null, input: unknown) {
    assertAdmin(actor);
    const data = id
      ? marketSchema.partial().parse(input)
      : marketSchema.parse(input);
    if (data.layoutImage)
      await UploadService.assertOwned(actor, data.layoutImage);
    return transaction(async (tx) => {
      if (id && data.timezone) {
        const existing = await tx.marketVenue.findUniqueOrThrow({
          where: { id },
        });
        if (existing.timezone !== data.timezone) await resetFuture(tx, id);
      }
      const row = id
        ? await tx.marketVenue.update({ where: { id }, data })
        : await tx.marketVenue.create({
            data: {
              ...marketSchema.parse(input),
              slug: `market-${randomUUID().slice(0, 12)}`,
            },
          });
      await audit(tx, actor, id ? "MARKET_UPDATED" : "MARKET_CREATED", row.id);
      return row;
    });
  }
  static async rule(actor: Actor, marketId: string, input: unknown) {
    assertAdmin(actor);
    const data = ruleSchema.parse(input);
    const row = await transaction(async (tx) => {
      await resetFuture(tx, marketId);
      await tx.marketScheduleRule.deleteMany({
        where: { marketId, weekday: data.weekday },
      });
      const row = await tx.marketScheduleRule.create({
        data: { ...data, marketId },
      });
      await audit(tx, actor, "SCHEDULE_SAVED", marketId, data);
      return row;
    });
    await MarketScheduleService.ensureSessions(new Date(), 21);
    return row;
  }
  static async deleteRule(actor: Actor, id: string) {
    assertAdmin(actor);
    await transaction(async (tx) => {
      const r = await tx.marketScheduleRule.findUniqueOrThrow({
        where: { id },
      });
      await resetFuture(tx, r.marketId);
      await tx.marketScheduleRule.delete({ where: { id } });
      await audit(tx, actor, "SCHEDULE_DELETED", id);
    });
  }
  static async exception(actor: Actor, marketId: string, input: unknown) {
    assertAdmin(actor);
    const data = exceptionSchema.parse(input);
    if (data.cancelled) {
      const session = await db.marketSession.findUnique({
        where: { marketId_date: { marketId, date: data.date } },
      });
      if (session) await this.session(actor, session.id, "CANCELLED");
    }
    const row = await transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "MarketVenue" SET timezone=timezone WHERE id=${marketId}`;
      const old = await tx.marketSession.findUnique({
        where: { marketId_date: { marketId, date: data.date } },
        include: { _count: { select: { attendances: true, products: true } } },
      });
      if (old && !data.cancelled) {
        invariant(
          !old._count.attendances && !old._count.products,
          "รอบตลาดมีร้านค้า กรุณายกเลิกรอบก่อนเปลี่ยนเวลา",
          409,
        );
        await tx.marketSession.delete({ where: { id: old.id } });
      }
      const row = await tx.marketScheduleException.upsert({
        where: { marketId_date: { marketId, date: data.date } },
        create: { ...data, marketId },
        update: data,
      });
      await audit(tx, actor, "EXCEPTION_SAVED", marketId, data);
      return row;
    });
    await MarketScheduleService.ensureSessions(new Date(), 21);
    return row;
  }
  static async zone(actor: Actor, marketId: string, input: unknown) {
    assertAdmin(actor);
    const data = z
      .object({ name: z.string().trim().min(1).max(80) })
      .parse(input);
    return transaction(async (tx) => {
      const row = await tx.marketZone.create({ data: { marketId, ...data } });
      await audit(tx, actor, "ZONE_CREATED", row.id, data);
      return row;
    });
  }
  static async stall(
    actor: Actor,
    marketId: string | null,
    id: string | null,
    input: unknown,
  ) {
    assertAdmin(actor);
    const data = id
      ? stallSchema.partial().parse(input)
      : stallSchema.parse(input);
    return transaction(async (tx) => {
      const old = id
        ? await tx.marketStall.findUniqueOrThrow({ where: { id } })
        : null;
      const venue = marketId ?? old!.marketId;
      if (data.zoneId) {
        const zone = await tx.marketZone.findUniqueOrThrow({
          where: { id: data.zoneId },
        });
        invariant(zone.marketId === venue, "โซนไม่อยู่ในตลาดนี้");
      }
      const row = id
        ? await tx.marketStall.update({ where: { id }, data })
        : await tx.marketStall.create({
            data: { ...stallSchema.parse(input), marketId: venue },
          });
      await audit(tx, actor, "STALL_SAVED", row.id);
      return row;
    });
  }
  static async session(actor: Actor, id: string, status: string) {
    assertAdmin(actor);
    invariant(["CANCELLED", "SCHEDULED"].includes(status), "สถานะไม่ถูกต้อง");
    return transaction(async (tx) => {
      const row = await tx.marketSession.update({
        where: { id },
        data: { status },
      });
      if (status === "CANCELLED") {
        const attendees = await tx.storeAttendance.findMany({
          where: { sessionId: id },
          select: { id: true },
        });
        await tx.stallAssignment.deleteMany({
          where: { attendanceId: { in: attendees.map((a) => a.id) } },
        });
        await tx.storeAttendance.updateMany({
          where: { sessionId: id },
          data: { status: "CANCELLED" },
        });
        const reservations = await tx.reservation.findMany({
          where: { status: "RESERVED", product: { sessionId: id } },
        });
        for (const r of reservations) {
          await tx.reservation.update({
            where: { id: r.id },
            data: { status: "CANCELLED" },
          });
          await tx.product.update({
            where: { id: r.productId },
            data: { stock: { increment: r.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: r.productId,
              reservationId: r.id,
              delta: r.quantity,
              reason: "MARKET_CANCELLED",
            },
          });
        }
      }
      await audit(tx, actor, "SESSION_" + status, id);
      return row;
    });
  }
  static async report(actor: Actor, id: string, input: unknown) {
    assertAdmin(actor);
    const data=z.object({status:z.enum(['OPEN','RESOLVED','DISMISSED'])}).parse(input);
    return transaction(async tx=>{
      const row=await tx.report.update({where:{id},data});
      await audit(tx,actor,'REPORT_REVIEWED',id,data);
      return row;
    });
  }
  static async setting(actor: Actor, input: unknown) {
    assertAdmin(actor);
    const data = z
      .object({
        key: z.enum([
          "siteName",
          "announcement",
          "marketRegistrationEnabled",
          "storeRegistrationEnabled",
          "reservationsEnabled",
          "foodRescueEnabled",
          "requireStoreApproval",
          "demoMode",
          "defaultDiscount",
        ]),
        value: z.union([
          z.string().max(2000),
          z.boolean(),
          z.object({
            kind: z.enum(["FIXED", "PERCENT_OFF", "FINAL_PERCENT"]),
            value: z.number().int().min(0).max(100000000),
            startsAt: z.iso.datetime(),
            endsAt: z.iso.datetime(),
          }),
        ]),
      })
      .parse(input);
    if (["siteName", "announcement"].includes(data.key))
      invariant(typeof data.value === "string", "ค่าต้องเป็นข้อความ");
    else if (data.key !== "defaultDiscount")
      invariant(typeof data.value === "boolean", "ค่าต้องเป็นจริงหรือเท็จ");
    return transaction(async (tx) => {
      if (data.key === "defaultDiscount") {
        invariant(typeof data.value === "object", "ส่วนลดไม่ถูกต้อง");
        const rule = data.value;
        invariant(
          rule.kind === "FIXED" || rule.value <= 100,
          "เปอร์เซ็นต์ต้องไม่เกิน 100",
        );
        invariant(
          new Date(rule.endsAt) > new Date(rule.startsAt),
          "เวลาไม่ถูกต้อง",
        );
        await tx.discountRule.deleteMany({ where: { productId: null } });
        await tx.discountRule.create({
          data: {
            ...rule,
            startsAt: new Date(rule.startsAt),
            endsAt: new Date(rule.endsAt),
            priority: -100,
          },
        });
      }
      const row = await tx.systemSetting.upsert({
        where: { key: data.key },
        create: data,
        update: { value: data.value },
      });
      await audit(tx, actor, "SETTING_SAVED", data.key);
      return row;
    });
  }
}
