import { AdminDeletionService, type DeletionKind } from "@/services/admin-deletion";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { checkOrigin, jsonBody, success, failure, rateLimit } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { assertOwner } from "@/lib/permissions";
import { StoreService, ProductService } from "@/services/products";
import { AttendanceService } from "@/services/attendance";
import { ReservationService } from "@/services/reservations";
import { UploadService } from "@/services/uploads";
import { AdminService } from "@/services/admin";
import { DemoService } from "@/services/demo";
import { InventoryService } from "@/services/inventory";
import {
  ResourceLifecycleService,
  type ResourceKind,
} from "@/services/resource-lifecycle";
import { MarketScheduleService } from "@/services/schedule";
import { PricingService } from "@/services/pricing";
import { profileSchema, attendanceSchema } from "@/lib/validation";
import { reportSchema } from "@/lib/report-validation";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const { path: p } = await context.params;
    const method = request.method;
    const url = new URL(request.url);
    if (method !== "GET") checkOrigin(request);
    if (method === "GET" && p[0] === "products" && p.length === 1) {
      const { products } = await import("@/lib/queries");
      return success(
        await products({ q: url.searchParams.get("q") ?? undefined }),
      );
    }
    if (method === "GET" && p[0] === "markets" && p.length === 1) {
      const { markets } = await import("@/lib/queries");
      return success(
        await markets(url.searchParams.get("session") ?? undefined),
      );
    }
    if (method === "GET" && p[0] === "markets" && p[1]) {
      const { market } = await import("@/lib/queries");
      return success(
        await market(p[1], url.searchParams.get("session") ?? undefined),
      );
    }
    const actor = p[0] === "admin" ? await requireAdmin() : await requireUser();
    if (method !== "GET")
      await rateLimit(
        `${actor.id}:${p[0]}`,
        p[0] === "uploads" ? 20 : p[0] === "reservations" ? 30 : 120,
      );
    const body =
      method === "GET" || (method === "DELETE" && request.body === null)
        ? {}
        : await jsonBody(request);
    if (p[0] === "profile") {
      if (method === "GET")
        return success({
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role,
        });
      if (method === "PATCH")
        return success(
          await db.user.update({
            where: { id: actor.id },
            data: profileSchema.parse(body),
            select: { id: true, name: true },
          }),
        );
    }
    if (p[0] === "stores") {
      if (method === "GET")
        return success(
          await db.store.findMany({ where: { ownerId: actor.id }, take: 50 }),
        );
      if (method === "POST" && p.length === 1)
        return success(await StoreService.create(actor, body), 201);
      if (method === "PATCH" && p.length === 2)
        return success(await StoreService.update(actor, p[1], body));
      if (method === "DELETE" && p.length === 2)
        return success(await StoreService.archive(actor, p[1]));
    }
    if (p[0] === "products") {
      if (p[2] === "inventory" && p.length === 3) {
        if (method === "POST")
          return success(await InventoryService.adjust(actor, p[1], body));
        if (method === "GET")
          return success(await InventoryService.summary(actor, p[1]));
      }
      if (method === "POST" && p.length === 1)
        return success(await ProductService.create(actor, body), 201);
      if (method === "PATCH" && p.length === 2)
        return success(await ProductService.update(actor, p[1], body));
      if (method === "DELETE" && p.length === 2)
        return success(await ProductService.archive(actor, p[1]));
      if (method === "POST" && p[2] === "duplicate")
        return success(await ProductService.duplicate(actor, p[1]), 201);
      if (method === "POST" && p[2] === "discounts")
        return success(await ProductService.discount(actor, p[1], body), 201);
      if (method === "DELETE" && p[2] === "discounts" && p[3]) {
        const product = await db.product.findUniqueOrThrow({
          where: { id: p[1] },
          include: { store: true },
        });
        assertOwner(actor, product.store);
        await db.discountRule.deleteMany({
          where: { id: p[3], productId: product.id },
        });
        return success({ deleted: true });
      }
      if (method === "GET" && p[2] === "pricing") {
        const product = await db.product.findUniqueOrThrow({
          where: { id: p[1] },
          include: { discounts: true, store: true },
        });
        assertOwner(actor, product.store);
        const at = url.searchParams.get("at");
        if (at) await requireAdmin();
        const now = at ? new Date(z.iso.datetime().parse(at)) : new Date();
        return success({
          ...PricingService.calculate(product.price, product.discounts, now),
          simulation: !!at,
        });
      }
    }
    if (p[0] === "attendance") {
      if (method === "GET" && p[1] === "selection" && p.length === 2) {
        const parsed = z.string().min(1).max(100).safeParse(url.searchParams.get("storeId"));
        if (!parsed.success) throw new AppError(400, "กรุณาเลือกร้าน");
        const { attendanceSelection } = await import("@/lib/attendance-selection");
        return success(await attendanceSelection(actor, parsed.data));
      }
      if (method === "POST" && p.length === 1) {
        const parsed = attendanceSchema.safeParse(body);
        if (!parsed.success)
          throw new AppError(400, body.authorized !== true
            ? "กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้"
            : "กรุณาตรวจสอบตลาด รอบตลาด และล็อกที่เลือก");
        return success(await AttendanceService.save(actor, parsed.data), 201);
      }
      if (method === "PATCH" && p.length === 2) {
        const parsed = attendanceSchema.pick({ stallId: true, status: true, authorized: true }).partial().safeParse(body);
        if (!parsed.success)
          throw new AppError(400, body.authorized !== undefined && body.authorized !== true
            ? "กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้"
            : "กรุณาตรวจสอบตลาด รอบตลาด และล็อกที่เลือก");
        try {
          return success(await AttendanceService.update(actor, p[1], parsed.data));
        } catch (error) {
          // A canceled attendance without an assignment cannot infer a stall;
          // keep this route's validation failures concise and fieldless too.
          if (error instanceof z.ZodError)
            throw new AppError(400, "กรุณาเลือกล็อกที่ต้องการบันทึก");
          throw error;
        }
      }
    }
    if (p[0] === "templates" && method === "POST") {
      const data = z
        .object({
          storeId: z.string(),
          marketId: z.string(),
          weekday: z.number().int().min(0).max(6),
          preferredCode: z.string().max(20).optional(),
        })
        .parse(body);
      const store = await db.store.findUniqueOrThrow({
        where: { id: data.storeId },
      });
      assertOwner(actor, store);
      return success(
        await db.attendanceTemplate.upsert({
          where: {
            storeId_marketId_weekday: {
              storeId: data.storeId,
              marketId: data.marketId,
              weekday: data.weekday,
            },
          },
          create: data,
          update: { preferredCode: data.preferredCode },
        }),
      );
    }
    if (p[0] === "reservations") {
      if (method === "GET" && p.length === 2 && p[1] === "pickup")
        throw new AppError(405, "ยืนยันรับสินค้าด้วยการสแกน QR เท่านั้น");
      if (method === "GET" && p.length === 2 && p[1] === "status")
        return success(await db.reservation.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 1000,
          select: { id: true, status: true, expiresAt: true } }));
      if (method === "POST" && p.length === 2 && p[1] === "pickup") {
        const data = z.object({ payload: z.string().min(1).max(1024), storeId: z.string().min(1).max(100).optional() }).strict().parse(body);
        try { return success(await ReservationService.redeemPickupQr(actor, data.payload, data.storeId)); }
        catch (error) {
          if (error instanceof Error && error.message === "QR นี้ไม่ใช่รหัสรับสินค้าของอิ่มต่อ") throw new AppError(400, error.message);
          throw error;
        }
      }
      if (method === "POST") {
        const data = z
          .object({
            productId: z.string(),
            quantity: z.number().int().min(1).max(100),
            idempotencyKey: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/).optional(),
          })
          .parse(body);
        return success(
          await ReservationService.create(actor, data.productId, data.quantity, data.idempotencyKey),
          201,
        );
      }
      if (method === "PATCH" && p[1]) {
        const data = z
          .object({
            status: z.enum(["COMPLETED", "CANCELLED", "NO_SHOW"]),
            pickupCode: z.string().max(100).optional(),
          })
          .parse(body);
        return success(
          await ReservationService.transition(
            actor,
            p[1],
            data.status,
            data.pickupCode,
          ),
        );
      }
      if (method === "GET") {
        await ReservationService.expire();
        return success(
          await db.reservation.findMany({
            where: { userId: actor.id },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  store: { select: { name: true, slug: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        );
      }
    }
    if (p[0] === "uploads" && method === "POST") {
      if (p[1] && p[2] === "finalize")
        return success(await UploadService.finalize(actor, p[1]));
      const data = z
        .object({ mime: z.string(), size: z.number().int().positive() })
        .parse(body);
      return success(
        await UploadService.authorize(actor, data.mime, data.size),
        201,
      );
    }
    if (p[0] === "reports" && method === "POST") {
      const parsed = reportSchema.safeParse(body);
      if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
      await rateLimit(`report:${actor.id}`, 5, 3600);
      return success(await db.report.create({ data: parsed.data }), 201);
    }
    if (p[0] === "admin") {
      const resourceKinds: Record<string, ResourceKind> = {
        markets: "market",
        zones: "zone",
        stalls: "stall",
      };
      if (resourceKinds[p[1]] && p[2]) {
        if (method === "GET" && p[3] === "deletion")
          return success(
            await ResourceLifecycleService.preview(
              actor,
              resourceKinds[p[1]],
              p[2],
            ),
          );
        if (method === "DELETE" && p.length === 3)
          return success(
            await ResourceLifecycleService.remove(
              actor,
              resourceKinds[p[1]],
              p[2],
              body,
            ),
          );
      }
      if (method === "PATCH" && p[1] === "zones" && p[2])
        return success(await AdminService.updateZone(actor, p[2], body));
      if (method === "POST" && p[1] === "markets" && p[2] && p[3] === "layout")
        return success(await AdminService.layout(actor, p[2], body));
      if (
        method === "POST" &&
        p[1] === "markets" &&
        p[2] &&
        p[3] === "stalls" &&
        p[4] === "batch"
      )
        return success(await AdminService.stallBatch(actor, p[2], body), 201);
      if (method === "GET") {
        const take = 100;
        switch (p[1]) {
          case "users":
            return success(
              await db.user.findMany({
                take,
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  suspended: true,
                  createdAt: true,
                  lastLogin: true,
                  demoBatchId: true,
                  _count: { select: { stores: true, reservations: true } },
                },
              }),
            );
          case "stores":
            return success(
              await db.store.findMany({
                take,
                include: {
                  _count: { select: { products: true, attendances: true } },
                },
              }),
            );
          case "products":
            return success(
              await db.product.findMany({
                take,
                include: {
                  store: { select: { id: true, name: true } },
                  discounts: true,
                },
              }),
            );
          case "markets":
            return success(
              await db.marketVenue.findMany({
                include: {
                  rules: true,
                  exceptions: true,
                  zones: true,
                  stalls: true,
                },
                take,
              }),
            );
          case "attendance":
            return success(
              await db.storeAttendance.findMany({
                take,
                include: {
                  store: true,
                  session: { include: { market: true } },
                  assignment: { include: { stall: true } },
                },
              }),
            );
          case "stalls":
            return success(
              await db.marketStall.findMany({
                take,
                include: { zone: true, market: true },
              }),
            );
          case "reservations":
            return success(
              await db.reservation.findMany({
                take,
                include: {
                  product: { select: { name: true } },
                  user: { select: { name: true } },
                },
              }),
            );
          case "audit-logs":
            return success(
              await db.auditLog.findMany({
                take,
                orderBy: { createdAt: "desc" },
              }),
            );
          case "settings":
            return success(await db.systemSetting.findMany());
          case "demo":
            return success(
              await db.demoBatch.findMany({
                take,
                orderBy: { createdAt: "desc" },
              }),
            );
          case "reports":
            return success(
              await db.report.findMany({
                take,
                include: { product: { select: { name: true } } },
              }),
            );
        }
      }
      const deletable: Record<string, DeletionKind> = { users: "user", stores: "store", products: "product", reservations: "reservation", attendance: "attendance", reports: "report" };
      if (method === "DELETE" && p.length === 3 && deletable[p[1]])
        return success(await AdminDeletionService.remove(actor, deletable[p[1]], p[2], body));
      if (p[1] === "reports" && method === "PATCH")
        return success(await AdminService.report(actor, p[2], body));
      if (p[1] === "users" && method === "PATCH")
        return success(await AdminService.user(actor, p[2], body));
      if (p[1] === "stores" && method === "PATCH")
        return success(await AdminService.store(actor, p[2], body));
      if (p[1] === "products" && method === "PATCH")
        return success(await AdminService.product(actor, p[2], body));
      if (p[1] === "markets") {
        if (method === "POST" && p.length === 2)
          return success(await AdminService.market(actor, null, body), 201);
        if (method === "PATCH" && p.length === 3)
          return success(await AdminService.market(actor, p[2], body));
        if (method === "POST" && p[3] === "rules")
          return success(await AdminService.rule(actor, p[2], body), 201);
        if (method === "POST" && p[3] === "exceptions")
          return success(await AdminService.exception(actor, p[2], body));
        if (method === "POST" && p[3] === "zones")
          return success(await AdminService.zone(actor, p[2], body), 201);
        if (method === "POST" && p[3] === "stalls")
          return success(
            await AdminService.stall(actor, p[2], null, body),
            201,
          );
      }
      if (p[1] === "rules" && method === "DELETE") {
        await AdminService.deleteRule(actor, p[2]);
        return success({ deleted: true });
      }
      if (p[1] === "stalls" && method === "PATCH")
        return success(await AdminService.stall(actor, null, p[2], body));
      if (p[1] === "sessions" && method === "PATCH")
        return success(
          await AdminService.session(
            actor,
            p[2],
            z.enum(["SCHEDULED", "CANCELLED"]).parse(body.status),
          ),
        );
      if (p[1] === "attendance" && method === "PATCH")
        return success(await AttendanceService.update(actor, p[2], body, true));
      if (p[1] === "settings" && (method === "PUT" || method === "POST"))
        return success(await AdminService.setting(actor, body));
      if (p[1] === "expire" && method === "POST")
        return success({
          productsProcessed: await ReservationService.expire(),
        });
      if (p[1] === "sessions" && method === "POST") {
        await MarketScheduleService.ensureSessions(new Date(), 21);
        return success({ generated: true });
      }
      if (p[1] === "demo") {
        await rateLimit(`demo:${actor.id}`, 5, 3600);
        if (method === "POST")
          return success(await DemoService.generate(body, actor.id), 201);
        if (method === "DELETE" && p[2])
          return success(await AdminDeletionService.remove(actor, "batch", p[2], body));
      }
    }
    throw new AppError(404, "ไม่พบ API นี้");
  } catch (error) {
    return failure(error);
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
