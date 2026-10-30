import { randomUUID } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import type { DemoBatch } from "@/generated/prisma/client";
import { AppError, invariant } from "@/lib/errors";
import { generateSessions } from "@/services/schedule";
import { PricingService } from "@/services/pricing";

export const DEMO_SCENARIOS = [
  "campus",
  "small-market",
  "large-market",
  "many-vendors",
  "few-vendors",
  "moving-vendor",
  "closed-merchant",
  "regular",
  "active-discounts",
  "upcoming-discounts",
  "rescue",
  "low-stock",
  "pickup",
] as const;
export type DemoConfig = {
  stores?: number;
  products?: number;
  customers?: number;
  stalls?: number;
  markets?: number;
  zones?: number;
  reservations?: number;
  scenario?: string;
};
function gate(): void {
  invariant(
    process.env.ENABLE_DEMO_GENERATOR === "true",
    "Demo generator is disabled",
    403,
  );
  invariant(
    process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true",
    "Production requires DEMO_MODE=true",
    403,
  );
}
function count(
  value: number | undefined,
  fallback: number,
  max: number,
  name: string,
  min = 1,
): number {
  const result = value ?? fallback;
  invariant(
    Number.isInteger(result) && result >= min && result <= max,
    `${name} must be an integer between ${min} and ${max}`,
  );
  return result;
}
const FOOD = [
  {
    name: "ข้าวกะเพราผัก",
    image: "rice",
    category: "meals",
    price: 5500,
    allergens: "มีถั่วเหลือง",
  },
  {
    name: "ชาไทยนมสด",
    image: "tea",
    category: "drinks",
    price: 3500,
    allergens: "มีนม",
  },
  {
    name: "ขนมปังอบใหม่",
    image: "bakery",
    category: "bakery",
    price: 4000,
    allergens: "มีกลูเตน ไข่ และนม",
  },
  {
    name: "ก๋วยเตี๋ยวผัก",
    image: "noodles",
    category: "meals",
    price: 4500,
    allergens: "มีกลูเตนและถั่วเหลือง",
  },
  {
    name: "ผลไม้ตามฤดู",
    image: "fruit",
    category: "groceries",
    price: 3000,
    allergens: "โปรดสอบถามส่วนผสมก่อนรับสินค้า",
  },
  {
    name: "กาแฟเย็น",
    image: "coffee",
    category: "drinks",
    price: 4500,
    allergens: "มีนม",
  },
];

export class DemoService {
  static async generate(
    config: DemoConfig = {},
    actorId: string,
  ): Promise<DemoBatch> {
    gate();
    invariant(Boolean(actorId), "An operator identity is required");
    const scenario = config.scenario ?? "campus";
    invariant(
      (DEMO_SCENARIOS as readonly string[]).includes(scenario),
      "Unknown demo scenario",
    );
    const stores = count(
      config.stores,
      scenario === "few-vendors" ? 4 : scenario === "many-vendors" ? 40 : 20,
      100,
      "stores",
    );
    const products = count(config.products, 100, 1000, "products");
    const customers = count(config.customers, 30, 300, "customers");
    const markets = count(config.markets, 2, 8, "markets");
    const zones = count(config.zones, 8, 64, "zones", markets);
    const stalls = count(config.stalls, 80, 500, "stalls", markets);
    const reservations = count(config.reservations, 20, 200, "reservations", 0);
    const now = new Date();
    return db.$transaction(
      async (tx) => {
        const batch = await tx.demoBatch.create({
          data: { label: `FICTIONAL · Campus Marketplace Demo · ${scenario}` },
        });
        const prefix = `${batch.id}:`;
        const id = (kind: string, index: number) => `${prefix}${kind}:${index}`;
        const users = Array.from({ length: stores + customers }, (_, i) => ({
          id: id("user", i),
          name: `[ตัวอย่าง] ${i < stores ? "ผู้ค้าสมมติ" : "ลูกค้าสมมติ"} ${i + 1}`,
          email: `sample-${i}@${batch.id}.invalid`,
          demoBatchId: batch.id,
          suspended: true,
        }));
        await tx.user.createMany({ data: users });
        const categoryDefs = [
          ["meals", "อาหารจานหลัก"],
          ["snacks", "ขนมและของว่าง"],
          ["drinks", "เครื่องดื่ม"],
          ["bakery", "เบเกอรี"],
          ["groceries", "ของสด"],
          ["goods", "สินค้าทั่วไป"],
          ["other", "อื่น ๆ"],
        ];
        await tx.productCategory.createMany({
          data: categoryDefs.map(([key, name]) => ({
            id: `${prefix}category:${key}`,
            name: `[ตัวอย่าง] ${name}`,
            food: key !== "goods" && key !== "other",
          })),
        });
        const venues = [];
        const venueStalls: { id: string; marketId: string; code: string }[][] =
          [];
        const today = formatInTimeZone(now, "Asia/Bangkok", "yyyy-MM-dd");
        const todayWeekday = new Date(`${today}T00:00:00Z`).getUTCDay();
        for (let i = 0; i < markets; i++) {
          const venue = await tx.marketVenue.create({
            data: {
              id: id("market", i),
              slug: `demo-${batch.id}-${i}`,
              name: `[ตัวอย่าง] ${i === 0 ? "ตลาดเล็ก" : i === 1 ? "ตลาดใหญ่" : `ตลาดสมมติ ${i + 1}`}`,
              type: i === 0 ? "SMALL" : "LARGE",
              description: "ตลาดและผังจำลองสำหรับการสาธิต ไม่ใช่สถานที่จริง",
              address: "วิทยาเขตสมมติ · ไม่มีพิกัดจริง",
              entrance: "ทางเข้าจำลองบนผังตัวอย่าง",
              timezone: "Asia/Bangkok",
              demoBatchId: batch.id,
            },
          });
          venues.push(venue);
          venueStalls.push([]);
          const zoneIds = [];
          for (let z = i; z < zones; z += markets) {
            const zoneId = id("zone", z);
            zoneIds.push(zoneId);
            await tx.marketZone.create({
              data: {
                id: zoneId,
                marketId: venue.id,
                name: `โซน ${String.fromCharCode(65 + Math.floor(z / markets))}`,
              },
            });
          }
          for (let s = i; s < stalls; s += markets) {
            const index = Math.floor(s / markets),
              zoneIndex = index % zoneIds.length;
            const stall = {
              id: id("stall", s),
              marketId: venue.id,
              code: `${String.fromCharCode(65 + zoneIndex)}${String(Math.floor(index / zoneIds.length) + 1).padStart(2, "0")}`,
            };
            await tx.marketStall.create({
              data: {
                ...stall,
                zoneId: zoneIds[zoneIndex],
                x: 0.1 + (index % 8) * 0.11,
                y:
                  0.15 +
                  (Math.floor(index / 8) * 0.7) /
                    Math.max(
                      1,
                      Math.ceil(Math.ceil((stalls - i) / markets) / 8) - 1,
                    ),
                directions: "ตำแหน่งสมมติบนแผนผังตัวอย่างเท่านั้น",
              },
            });
            venueStalls[i].push(stall);
          }
          const weekdays = i === 0 ? [1, 3] : [2, 4, 5];
          const rules = weekdays.map((weekday, index) => ({
            id: id(`rule-${i}`, index),
            marketId: venue.id,
            weekday,
            opens: "16:00",
            closes: "21:00",
            intervalWeeks: weekday === 3 ? 2 : 1,
            anchorDate: "2026-01-05",
            active: true,
          }));
          await tx.marketScheduleRule.createMany({ data: rules });
          const cancelled =
            (scenario === "small-market" && i !== 0) ||
            (scenario === "large-market" && i !== 1);
          const exception = {
            id: id("exception", i),
            marketId: venue.id,
            date: today,
            cancelled,
            opens: "00:00",
            closes: "23:59",
            reason: "ตัวอย่างเท่านั้น · เปิดตลอดวันเพื่อสาธิต ไม่ใช่ตารางจริง",
          };
          await tx.marketScheduleException.create({ data: exception });
          const sessions = generateSessions({
            timezone: venue.timezone,
            rules,
            exceptions: [exception],
            from: now,
            days: 21,
          });
          await tx.marketSession.createMany({
            data: sessions.map((session, index) => ({
              ...session,
              id: id(`session-${i}`, index),
              marketId: venue.id,
              demoBatchId: batch.id,
            })),
          });
        }
        const sessions = await tx.marketSession.findMany({
          where: {
            demoBatchId: batch.id,
            date: today,
            status: { not: "CANCELLED" },
          },
          orderBy: { marketId: "asc" },
        });
        const storeRows = [];
        const attendances = [];
        for (let i = 0; i < stores; i++) {
          const store = await tx.store.create({
            data: {
              id: id("store", i),
              slug: `sample-store-${batch.id}-${i}`,
              name: `[ตัวอย่าง] ${["ครัวอิ่มใจ", "ชื่นชา", "ขนมอุ่นใจ", "เส้นสุขใจ", "สวนผลไม้", "กาแฟเพื่อนกัน"][i % 6]} ${i + 1}`,
              description: "ร้านสมมติสำหรับสาธิต ไม่มีผู้ค้าจริง",
              imageUrl: `/images/${FOOD[i % FOOD.length].image}.jpg`,
              ownerId: users[i].id,
              kind: i % 5 === 0 ? "PERMANENT" : "MARKET",
              address: i % 5 === 0 ? "อาคารสมมติ · ไม่ใช่สถานที่จริง" : null,
              open: scenario === "closed-merchant" ? false : i % 7 !== 0,
              demoBatchId: batch.id,
            },
          });
          storeRows.push(store);
          const session = sessions.length
            ? sessions[i % sessions.length]
            : null;
          const marketIndex = session
            ? venues.findIndex((m) => m.id === session.marketId)
            : -1;
          const candidate =
            marketIndex >= 0
              ? venueStalls[marketIndex][Math.floor(i / sessions.length)]
              : null;
          if (session && candidate && store.kind !== "PERMANENT") {
            const attendance = await tx.storeAttendance.create({
              data: {
                id: id("attendance", i),
                storeId: store.id,
                sessionId: session.id,
                status: store.open ? "OPEN" : "SCHEDULED",
                authorized: true,
                assignment: {
                  create: {
                    id: id("assignment", i),
                    stallId: candidate.id,
                    startsAt: session.startsAt,
                    endsAt: session.endsAt,
                    verified: false,
                  },
                },
              },
            });
            attendances.push(attendance);
            await tx.attendanceTemplate.create({
              data: {
                id: id("template", i),
                storeId: store.id,
                marketId: session.marketId,
                weekday: todayWeekday,
                preferredCode: candidate.code,
              },
            });
          }
        }
        const productRows = [];
        for (let i = 0; i < products; i++) {
          const food = FOOD[i % FOOD.length],
            store = storeRows[i % stores];
          const attendance = attendances.find(
            (item) => item.storeId === store.id,
          );
          const mode =
            scenario === "regular"
              ? "REGULAR"
              : scenario === "rescue"
                ? "RESCUE"
                : i % 3 === 0
                  ? "REGULAR"
                  : i % 3 === 1
                    ? "DISCOUNT"
                    : "RESCUE";
          const reservable =
            i % 4 !== 0 || products === 1 || scenario === "pickup";
          const attendingSession = attendance
            ? sessions.find((session) => session.id === attendance.sessionId)
            : null;
          const pickupEnd = new Date(
            Math.min(
              now.getTime() + 4 * 60 * 60 * 1000,
              attendingSession?.endsAt.getTime() ?? Infinity,
            ),
          );
          const product = await tx.product.create({
            data: {
              id: id("product", i),
              storeId: store.id,
              sessionId: attendance?.sessionId ?? null,
              categoryId: `${prefix}category:${food.category}`,
              name: `[ตัวอย่าง] ${food.name} ${i + 1}`,
              description:
                "สินค้าสมมติ ไม่สามารถสั่งซื้อจริง · ภาพประกอบตัวอย่าง",
              imageUrl: `/images/${food.image}.jpg`,
              price: food.price,
              mode,
              reservable,
              stock: reservable ? (scenario === "low-stock" ? 1 : 12) : null,
              pickupStart: reservable ? now : null,
              pickupEnd: reservable || mode === "RESCUE" ? pickupEnd : null,
              allergens: food.allergens,
              storage:
                "อาหารตัวอย่าง · สินค้าจริงต้องระบุการเก็บรักษาและข้อควรระวัง",
              demoBatchId: batch.id,
            },
          });
          productRows.push(product);
          if (mode !== "REGULAR") {
            const upcoming =
              scenario === "upcoming-discounts" ||
              (scenario !== "active-discounts" && i % 5 === 0);
            await tx.discountRule.create({
              data: {
                id: id("discount", i),
                productId: product.id,
                kind: mode === "RESCUE" ? "FIXED" : "FINAL_PERCENT",
                value: mode === "RESCUE" ? 1500 : 30,
                startsAt: new Date(
                  now.getTime() + (upcoming ? 60 : -60) * 60 * 1000,
                ),
                endsAt: pickupEnd,
                priority: 10,
              },
            });
          }
        }
        const reservableProducts = productRows.filter(
          (product) => product.reservable,
        );
        if (reservations && reservableProducts.length === 0)
          throw new AppError(
            400,
            "Reservation demo requires at least one reservable product",
          );
        for (let i = 0; i < reservations; i++) {
          const product = reservableProducts[i % reservableProducts.length];
          const rules = await tx.discountRule.findMany({
            where: { productId: product.id },
          });
          const unitPrice = PricingService.calculate(
            product.price,
            rules,
            now,
          ).current;
          const completed = i % 2 === 0;
          const reservation = await tx.reservation.create({
            data: {
              id: id("reservation", i),
              userId: users[stores + (i % customers)].id,
              productId: product.id,
              quantity: 1,
              unitPrice,
              originalPrice: product.price,
              productMode: product.mode,
              status: completed ? "COMPLETED" : "RESERVED",
              pickupCode: `DEMO-${randomUUID()}`,
              expiresAt: product.pickupEnd!,
              completedAt: completed ? now : null,
              demoBatchId: batch.id,
            },
          });
          // Keep coherent inventory for any configured product/reservation ratio.
          const current = await tx.product.findUniqueOrThrow({
            where: { id: product.id },
            select: { stock: true },
          });
          if ((current.stock ?? 0) < 1)
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { increment: 1 } },
            });
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: 1 } },
          });
          await tx.inventoryMovement.create({
            data: {
              id: id("movement", i),
              productId: product.id,
              reservationId: reservation.id,
              delta: -1,
              reason: completed ? "DEMO_PICKUP" : "DEMO_RESERVATION",
            },
          });
        }
        if (scenario === "moving-vendor" && attendances.length) {
          const attendance = attendances[0];
          const assignment = await tx.stallAssignment.findUniqueOrThrow({
            where: { attendanceId: attendance.id },
            include: { stall: true },
          });
          const available = await tx.marketStall.findFirst({
            where: {
              marketId: assignment.stall.marketId,
              id: { not: assignment.stallId },
              assignments: {
                none: {
                  startsAt: { lt: assignment.endsAt },
                  endsAt: { gt: assignment.startsAt },
                },
              },
            },
          });
          if (available) {
            await tx.stallAssignment.update({
              where: { id: assignment.id },
              data: { stallId: available.id },
            });
            await tx.auditLog.create({
              data: {
                actorId,
                action: "DEMO_STALL_MOVED",
                target: attendance.id,
                changes: {
                  from: assignment.stallId,
                  to: available.id,
                  batchId: batch.id,
                },
              },
            });
          }
        }
        await tx.auditLog.create({
          data: {
            actorId,
            action: "DEMO_GENERATED",
            target: batch.id,
            changes: {
              stores,
              products,
              customers,
              stalls,
              markets,
              zones,
              reservations,
              scenario,
              fictional: true,
            },
          },
        });
        return batch;
      },
      { isolationLevel: "Serializable", timeout: 120_000, maxWait: 10_000 },
    );
  }

  static async cleanup(batchId: string, actorId: string): Promise<void> {
    gate();
    invariant(
      Boolean(batchId) && Boolean(actorId),
      "A batch and operator identity are required",
    );
    await db.$transaction(
      async (tx) => {
        // Explicit table locks close the check/delete race even with uncooperative writers.
        // Cleanup is rare/admin-only; never trade genuine records for a faster demo reset.
        await tx.$executeRaw`LOCK TABLE "User", "Account", "Session", "Upload", "Store", "StoreMember", "MarketVenue", "MarketZone", "MarketStall", "MarketScheduleRule", "MarketScheduleException", "MarketSession", "StoreAttendance", "StallAssignment", "AttendanceTemplate", "ProductCategory", "Product", "DiscountRule", "Reservation", "InventoryMovement", "Report" IN SHARE ROW EXCLUSIVE MODE`;
        const batch = await tx.demoBatch.findUnique({ where: { id: batchId } });
        invariant(batch, "Demo batch not found", 404);
        const prefix = `${batchId}:`;
        const notBatch = {
          OR: [{ demoBatchId: null }, { demoBatchId: { not: batchId } }],
        };
        const foreignId = { id: { not: { startsWith: prefix } } };
        const checks = await Promise.all([
          tx.user.count({
            where: {
              demoBatchId: batchId,
              OR: [
                { email: null },
                { NOT: { email: { endsWith: ".invalid" } } },
                { suspended: false },
                { accounts: { some: {} } },
                { sessions: { some: {} } },
                { uploads: { some: {} } },
                { stores: { some: notBatch } },
                { reservations: { some: notBatch } },
              ],
            },
          }),
          tx.store.count({ where: { demoBatchId: batchId, owner: notBatch } }),
          tx.storeMember.count({
            where: {
              OR: [
                { store: { demoBatchId: batchId } },
                { user: { demoBatchId: batchId } },
              ],
              AND: [
                { OR: [foreignId, { store: notBatch }, { user: notBatch }] },
              ],
            },
          }),
          tx.product.count({
            where: {
              OR: [
                { demoBatchId: batchId },
                { store: { demoBatchId: batchId } },
                { session: { demoBatchId: batchId } },
              ],
              AND: [
                {
                  OR: [
                    notBatch,
                    { store: notBatch },
                    { session: { is: { ...notBatch } } },
                  ],
                },
              ],
            },
          }),
          tx.reservation.count({
            where: {
              OR: [
                { demoBatchId: batchId },
                { user: { demoBatchId: batchId } },
                { product: { demoBatchId: batchId } },
              ],
              AND: [
                { OR: [notBatch, { user: notBatch }, { product: notBatch }] },
              ],
            },
          }),
          tx.marketSession.count({
            where: {
              OR: [
                { demoBatchId: batchId },
                { market: { demoBatchId: batchId } },
              ],
              AND: [{ OR: [notBatch, { market: notBatch }] }],
            },
          }),
          tx.marketZone.count({
            where: { market: { demoBatchId: batchId }, ...foreignId },
          }),
          tx.marketStall.count({
            where: {
              OR: [
                { market: { demoBatchId: batchId } },
                { zone: { market: { demoBatchId: batchId } } },
              ],
              AND: [
                {
                  OR: [
                    foreignId,
                    { market: notBatch },
                    { zone: { market: notBatch } },
                  ],
                },
              ],
            },
          }),
          tx.marketScheduleRule.count({
            where: { market: { demoBatchId: batchId }, ...foreignId },
          }),
          tx.marketScheduleException.count({
            where: { market: { demoBatchId: batchId }, ...foreignId },
          }),
          tx.storeAttendance.count({
            where: {
              OR: [
                { store: { demoBatchId: batchId } },
                { session: { demoBatchId: batchId } },
              ],
              AND: [
                { OR: [foreignId, { store: notBatch }, { session: notBatch }] },
              ],
            },
          }),
          tx.stallAssignment.count({
            where: {
              OR: [
                { stall: { market: { demoBatchId: batchId } } },
                { attendance: { store: { demoBatchId: batchId } } },
                { attendance: { session: { demoBatchId: batchId } } },
              ],
              AND: [
                {
                  OR: [
                    foreignId,
                    { stall: { market: notBatch } },
                    { attendance: { store: notBatch } },
                    { attendance: { session: notBatch } },
                  ],
                },
              ],
            },
          }),
          tx.attendanceTemplate.count({
            where: {
              OR: [
                { market: { demoBatchId: batchId } },
                { store: { demoBatchId: batchId } },
              ],
              AND: [
                { OR: [foreignId, { market: notBatch }, { store: notBatch }] },
              ],
            },
          }),
          tx.discountRule.count({
            where: { product: { demoBatchId: batchId }, ...foreignId },
          }),
          tx.inventoryMovement.count({
            where: {
              OR: [
                { product: { demoBatchId: batchId } },
                { reservation: { demoBatchId: batchId } },
              ],
              AND: [
                {
                  OR: [
                    foreignId,
                    { product: notBatch },
                    { reservation: { is: { ...notBatch } } },
                  ],
                },
              ],
            },
          }),
          tx.report.count({ where: { product: { demoBatchId: batchId } } }),
          tx.product.count({
            where: {
              categoryId: { startsWith: `${prefix}category:` },
              ...notBatch,
            },
          }),
        ]);
        invariant(
          checks.every((value) => value === 0),
          "Cleanup blocked: genuine or unowned records reference this demo batch",
          409,
        );
        await tx.inventoryMovement.deleteMany({
          where: { product: { demoBatchId: batchId } },
        });
        await tx.reservation.deleteMany({ where: { demoBatchId: batchId } });
        await tx.product.deleteMany({ where: { demoBatchId: batchId } });
        await tx.store.deleteMany({ where: { demoBatchId: batchId } });
        await tx.marketVenue.deleteMany({ where: { demoBatchId: batchId } });
        await tx.user.deleteMany({ where: { demoBatchId: batchId } });
        await tx.productCategory.deleteMany({
          where: { id: { startsWith: `${prefix}category:` } },
        });
        await tx.demoBatch.delete({ where: { id: batchId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "DEMO_CLEANED",
            target: batchId,
            changes: { label: batch.label, verifiedNoForeignReferences: true },
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 30_000, maxWait: 10_000 },
    );
  }
}
