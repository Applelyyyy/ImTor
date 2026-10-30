import { db } from "@/lib/db";
import { assertOwner, isAdmin, type Actor } from "@/lib/permissions";
import { invariant } from "@/lib/errors";
import type { AttendanceSelectionView } from "@/lib/contracts";
import { MarketScheduleService } from "@/services/schedule";

/** Private selection DTO. Never send owners, contacts or full store records to the browser. */
export async function attendanceSelection(
  actor: Actor,
  storeId: string,
): Promise<AttendanceSelectionView> {
  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { ownerId: true, suspended: true },
  });
  assertOwner(actor, store);
  invariant(!store.suspended, "ร้านถูกระงับ", 403);
  const now = new Date();
  // Match the public market horizon, including direct dashboard visits after
  // previously materialized sessions have expired. Authorization comes first.
  await MarketScheduleService.ensureSessions(now, 42);
  const [registration, markets] = await Promise.all([
    db.systemSetting.findUnique({ where: { key: "marketRegistrationEnabled" } }),
    db.marketVenue.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true, slug: true, name: true, entrance: true, timezone: true,
        layoutImage: true, demoBatchId: true,
        zones: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        sessions: {
          where: { status: { in: ["SCHEDULED", "OPEN"] }, endsAt: { gt: now } },
          orderBy: { startsAt: "asc" }, take: 60,
          select: {
            id: true, date: true, startsAt: true, endsAt: true, status: true,
            attendances: {
              where: { storeId },
              select: { id: true, status: true, assignment: { select: { stallId: true, verified: true } } },
            },
          },
        },
      },
    }),
  ]);
  const selectionMarkets = await Promise.all(markets.map(async (market) => {
    // Include every persisted overlapping assignment, even if its store is hidden
    // or its attendance has stale status. This mirrors the database exclusion guard.
    const intervals = market.sessions.map((session) => ({
      startsAt: { lt: session.endsAt }, endsAt: { gt: session.startsAt },
    }));
    const stalls = await db.marketStall.findMany({
      where: { marketId: market.id }, orderBy: { code: "asc" },
      select: {
        id: true, code: true, x: true, y: true, active: true, directions: true,
        zoneId: true, zone: { select: { name: true } },
        assignments: {
          where: intervals.length ? { OR: intervals } : { id: { in: [] } },
          select: {
            startsAt: true, endsAt: true, verified: true,
            attendance: { select: {
              sessionId: true, storeId: true,
              store: { select: { name: true, slug: true, hidden: true, suspended: true } },
            } },
          },
        },
      },
    });
    return {
      id: market.id, slug: market.slug, name: market.name, entrance: market.entrance,
      timezone: market.timezone, layoutImage: market.layoutImage, demo: !!market.demoBatchId,
      zones: market.zones,
      sessions: market.sessions.map((session) => ({
        id: session.id, date: session.date,
        startsAt: session.startsAt.toISOString(), endsAt: session.endsAt.toISOString(),
        status: session.startsAt <= now ? "OPEN" : "SCHEDULED",
        currentAttendance: session.attendances[0] ? {
          id: session.attendances[0].id, status: session.attendances[0].status,
          stallId: session.attendances[0].assignment?.stallId ?? null,
          verified: session.attendances[0].assignment?.verified ?? false,
        } : null,
      })),
      stalls: stalls.map((stall) => ({
        id: stall.id, code: stall.code, x: stall.x, y: stall.y, active: stall.active,
        directions: stall.directions, zoneId: stall.zoneId, zone: stall.zone.name,
        assignments: stall.assignments.map((assignment) => ({
          sessionId: assignment.attendance.sessionId,
          startsAt: assignment.startsAt.toISOString(), endsAt: assignment.endsAt.toISOString(),
          own: assignment.attendance.storeId === storeId, verified: assignment.verified,
          store: !assignment.attendance.store.hidden && !assignment.attendance.store.suspended
            ? { name: assignment.attendance.store.name, slug: assignment.attendance.store.slug } : null,
        })),
      })),
    };
  }));
  return { storeId, registrationEnabled: registration?.value !== false || isAdmin(actor), markets: selectionMarkets };
}
