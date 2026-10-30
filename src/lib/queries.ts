import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { type DiscountInput, PricingService } from "@/services/pricing";
import { ReservationService } from "@/services/reservations";
import { MarketScheduleService } from "@/services/schedule";
import type { ProductView, MarketView, SessionView } from "@/lib/contracts";
import type { Prisma } from "@/generated/prisma/client";

// Public settings are explicitly allowlisted; security flags are environment-only.
export const publicBranding = cache(async () => {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ["siteName", "announcement"] } },
    select: { key: true, value: true },
  });
  const text = (key: string) => {
    const value = rows.find((r) => r.key === key)?.value;
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    siteName: text("siteName").slice(0, 160),
    announcement: text("announcement"),
  };
});
export const publicFeatures = cache(async () => {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ["reservationsEnabled", "foodRescueEnabled"] } },
    select: { key: true, value: true },
  });
  return {
    reservationsEnabled:
      rows.find((r) => r.key === "reservationsEnabled")?.value !== false,
    foodRescueEnabled:
      rows.find((r) => r.key === "foodRescueEnabled")?.value !== false,
  };
});

const productInclude = {
  category: true,
  discounts: true,
  store: {
    include: {
      attendances: {
        include: {
          session: { include: { market: true } },
          assignment: { include: { stall: { include: { zone: true } } } },
        },
      },
    },
  },
  session: { include: { market: true } },
} satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
export function productDTO(
  p: ProductRow,
  globalRules: DiscountInput[] = [],
): ProductView {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(now);
  const eligible = p.store.attendances.filter(
    (a) =>
      !["CANCELLED", "CLOSED", "NOT_ATTENDING"].includes(a.status) &&
      !["CANCELLED", "CLOSED"].includes(a.session.status) &&
      a.session.endsAt > now,
  );
  const attendance =
    (p.sessionId ? eligible.find((a) => a.sessionId === p.sessionId) : null) ??
    eligible.find((a) => a.session.startsAt <= now) ??
    eligible.find((a) => a.session.date === today);
  const stall = attendance?.assignment?.stall;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    mode: p.mode,
    reservable: p.reservable,
    stock: p.stock,
    allergens: p.allergens,
    storage: p.storage,
    pickupStart: p.pickupStart?.toISOString() ?? null,
    pickupEnd: p.pickupEnd?.toISOString() ?? null,
    demo: !!p.demoBatchId,
    price: PricingService.calculate(
      p.price,
      p.mode === "REGULAR" ? [] : [...p.discounts, ...globalRules],
    ),
    store: {
      id: p.store.id,
      slug: p.store.slug,
      name: p.store.name,
      verified: p.store.verified,
    },
    category: { id: p.category.id, name: p.category.name },
    location: attendance
      ? `${attendance.session.market.name}${stall ? ` · โซน ${stall.zone.name} · ล็อก ${stall.code}` : ""}`
      : p.store.address || "ยังไม่ระบุตำแหน่งวันนี้",
    open:
      (attendance?.status === "OPEN" &&
        attendance.session.startsAt <= now &&
        attendance.session.endsAt > now) ||
      (p.store.kind !== "MARKET" && p.store.open),
    marketSlug: attendance?.session.market.slug ?? null,
    stallCode: stall?.code ?? null,
  };
}
export type Filters = {
  q?: string;
  category?: string;
  filter?: string;
  market?: string;
  storeId?: string;
};
export async function products(filters: Filters = {}): Promise<ProductView[]> {
  await ReservationService.expire();
  const features = await publicFeatures();
  if (filters.filter === "rescue" && !features.foodRescueEnabled) return [];
  filters = Object.fromEntries(
    Object.entries(filters)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => [k, (v as string).slice(0, k === "q" ? 160 : 100)]),
  );
  const rows = await db.product.findMany({
    where: {
      published: true,
      archived: false,
      store: { suspended: false, hidden: false },
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { store: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(filters.category ? { categoryId: filters.category } : {}),
      ...(filters.storeId ? { storeId: filters.storeId } : {}),
      ...(filters.filter === "rescue"
        ? { mode: "RESCUE" }
        : !features.foodRescueEnabled
          ? { mode: { not: "RESCUE" } }
          : {}),
    },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const globalRules = await db.discountRule.findMany({
    where: { productId: null },
  });
  return rows
    .map((p) => productDTO(p, globalRules))
    .filter(
      (p) =>
        (filters.filter !== "discount" || p.price.active) &&
        (filters.filter !== "open" || p.open) &&
        (!filters.market || p.marketSlug === filters.market),
    );
}
export async function product(id: string) {
  const features = await publicFeatures();
  const p = await db.product.findFirst({
    where: {
      id,
      ...(!features.foodRescueEnabled ? { mode: { not: "RESCUE" } } : {}),
      published: true,
      archived: false,
      store: { suspended: false, hidden: false },
    },
    include: productInclude,
  });
  return p
    ? productDTO(
        p,
        await db.discountRule.findMany({ where: { productId: null } }),
      )
    : null;
}
export async function markets(
  selectedSessionId?: string,
): Promise<MarketView[]> {
  await MarketScheduleService.ensureSessions(new Date(), 42);
  const now = new Date();
  const start = new Date(now.getTime() - 86400000);
  const rows = await db.marketVenue.findMany({
    where: { active: true },
    include: {
      sessions: {
        where: { endsAt: { gte: start } },
        orderBy: { startsAt: "asc" },
        take: 60,
        include: {
          attendances: { include: { store: true, assignment: true } },
        },
      },
      stalls: {
        orderBy: { code: "asc" },
        include: {
          zone: true,
          assignments: {
            where: {
              endsAt: { gte: now },
              attendance: {
                status: { notIn: ["CANCELLED", "CLOSED", "NOT_ATTENDING"] },
                store: { hidden: false, suspended: false },
              },
            },
            include: { attendance: { include: { store: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    type: m.type,
    description: m.description,
    address: m.address,
    entrance: m.entrance,
    latitude: m.latitude,
    longitude: m.longitude,
    timezone: m.timezone,
    layoutImage: m.layoutImage,
    demo: !!m.demoBatchId,
    sessions: m.sessions.map(
      (s) =>
        ({
          id: s.id,
          date: s.date,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          status: MarketScheduleService.status(s),
          vendorCount: s.attendances.filter(
            (a) =>
              !a.store.hidden &&
              !a.store.suspended &&
              !["CANCELLED", "NOT_ATTENDING"].includes(a.status),
          ).length,
          confirmedCount: s.attendances.filter(
            (a) => !a.store.hidden && !a.store.suspended && a.status === "OPEN",
          ).length,
          marketId: m.id,
        }) satisfies SessionView,
    ),
    stalls: m.stalls.map((s) => {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: m.timezone,
      }).format(now);
      const selected =
        m.sessions.find((v) => v.id === selectedSessionId) ??
        m.sessions.find((v) => v.date === today && v.status !== "CANCELLED") ??
        m.sessions.find((v) => v.endsAt > now && v.status !== "CANCELLED");
      const a = s.assignments.find(
        (a) => a.attendance.sessionId === selected?.id,
      );
      return {
        id: s.id,
        code: s.code,
        x: s.x,
        y: s.y,
        active: s.active,
        directions: s.directions,
        zone: s.zone.name,
        vendor: a
          ? {
              slug: a.attendance.store.slug,
              name: a.attendance.store.name,
              status: a.attendance.status,
              verified: a.verified,
            }
          : null,
      };
    }),
  }));
}
export async function market(slug: string, selectedSessionId?: string) {
  return (
    (await markets(selectedSessionId)).find((m) => m.slug === slug) ?? null
  );
}
export async function store(slug: string) {
  return db.store.findFirst({
    where: { slug, hidden: false, suspended: false },
    include: {
      attendances: {
        orderBy: { session: { startsAt: "asc" } },
        include: {
          session: { include: { market: true } },
          assignment: { include: { stall: { include: { zone: true } } } },
        },
      },
    },
  });
}
export async function categories() {
  return db.productCategory.findMany({ orderBy: { name: "asc" } });
}
export async function dashboardStore(userId: string) {
  return db.store.findFirst({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: {
      products: {
        include: { category: true, discounts: true },
        orderBy: { createdAt: "desc" },
      },
      attendances: {
        include: {
          session: { include: { market: true } },
          assignment: { include: { stall: true } },
        },
      },
      templates: true,
    },
  });
}
export async function reservations(userId: string, storeId?: string) {
  await ReservationService.expire();
  return db.reservation.findMany({
    where: storeId ? { product: { storeId } } : { userId },
    include: { product: { include: { store: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
