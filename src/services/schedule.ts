import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db";

export type ScheduleRuleInput = {
  weekday: number;
  opens: string;
  closes: string;
  intervalWeeks: number;
  anchorDate: string;
  active?: boolean;
};
export type ScheduleExceptionInput = {
  date: string;
  cancelled: boolean;
  opens?: string | null;
  closes?: string | null;
};
export type GeneratedSession = {
  date: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};
const DAY = 86_400_000;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Calendar arithmetic uses UTC only as a date carrier, never as the venue timezone. */
export function shiftCalendarDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid calendar date");
  return new Date(value.getTime() + days * DAY).toISOString().slice(0, 10);
}
export function localInstant(
  date: string,
  time: string,
  timezone: string,
): Date {
  shiftCalendarDate(date, 0);
  if (!CLOCK.test(time)) throw new Error("Invalid local time");
  const instant = fromZonedTime(`${date}T${time}:00`, timezone);
  // A spring-forward gap must not silently move a market's opening hour.
  if (
    !Number.isFinite(instant.getTime()) ||
    formatInTimeZone(instant, timezone, "yyyy-MM-dd HH:mm") !==
      `${date} ${time}`
  )
    throw new Error("Local time does not exist in this timezone");
  return instant;
}

/** One session per venue/local date. A closure overrides recurrence; hours create one-offs. */
export function generateSessions(input: {
  timezone: string;
  rules: ScheduleRuleInput[];
  exceptions: ScheduleExceptionInput[];
  from?: Date;
  days?: number;
}): GeneratedSession[] {
  const { timezone, rules, exceptions, from = new Date(), days = 21 } = input;
  if (!Number.isInteger(days) || days < 1 || days > 366)
    throw new Error("Schedule horizon must be 1–366 days");
  const today = formatInTimeZone(from, timezone, "yyyy-MM-dd");
  const active = rules.filter((rule) => rule.active !== false);
  const weekdays = new Set<number>();
  for (const rule of active) {
    const anchor = shiftCalendarDate(rule.anchorDate, 0);
    if (
      !Number.isInteger(rule.weekday) ||
      rule.weekday < 0 ||
      rule.weekday > 6 ||
      ![1, 2].includes(rule.intervalWeeks) ||
      new Date(`${anchor}T00:00:00Z`).getUTCDay() !== 1 ||
      !CLOCK.test(rule.opens) ||
      !CLOCK.test(rule.closes) ||
      rule.opens === rule.closes
    )
      throw new Error("Invalid recurrence rule");
    if (weekdays.has(rule.weekday))
      throw new Error("Only one active session per weekday is supported");
    weekdays.add(rule.weekday);
  }
  const overrides = new Map<string, ScheduleExceptionInput>();
  for (const item of exceptions) {
    shiftCalendarDate(item.date, 0);
    if (
      overrides.has(item.date) ||
      Boolean(item.opens) !== Boolean(item.closes) ||
      (item.opens &&
        (!CLOCK.test(item.opens) ||
          !CLOCK.test(item.closes!) ||
          item.opens === item.closes))
    )
      throw new Error("Invalid schedule exception");
    overrides.set(item.date, item);
  }
  const result: GeneratedSession[] = [];
  // Include yesterday because its overnight session can still be open today.
  for (let day = -1; day < days; day++) {
    const date = shiftCalendarDate(today, day);
    const carrier = new Date(`${date}T00:00:00Z`);
    const rule = active.find((item) => {
      if (item.weekday !== carrier.getUTCDay()) return false;
      const monday = shiftCalendarDate(date, -((carrier.getUTCDay() + 6) % 7));
      const weeks = Math.round(
        (Date.parse(`${monday}T00:00:00Z`) -
          Date.parse(`${item.anchorDate}T00:00:00Z`)) /
          (7 * DAY),
      );
      return (
        ((weeks % item.intervalWeeks) + item.intervalWeeks) %
          item.intervalWeeks ===
        0
      );
    });
    const exception = overrides.get(date);
    const opens = exception?.opens ?? rule?.opens;
    const closes = exception?.closes ?? rule?.closes;
    if (!opens || !closes) continue;
    const startsAt = localInstant(date, opens, timezone);
    const endsAt = localInstant(
      closes <= opens ? shiftCalendarDate(date, 1) : date,
      closes,
      timezone,
    );
    if (endsAt <= startsAt)
      throw new Error("Market session must have a positive duration");
    result.push({
      date,
      startsAt,
      endsAt,
      status: exception?.cancelled ? "CANCELLED" : "SCHEDULED",
    });
  }
  return result;
}

export class MarketScheduleService {
  static status(
    session: { startsAt: Date | string; endsAt: Date | string; status: string },
    now = new Date(),
  ): string {
    if (session.status === "CANCELLED") return "CANCELLED";
    const start = new Date(session.startsAt).getTime(),
      end = new Date(session.endsAt).getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      !Number.isFinite(now.getTime())
    )
      throw new Error("Invalid session interval");
    if (now.getTime() < start) return "SCHEDULED";
    if (now.getTime() >= end) return "FINISHED";
    return "OPEN";
  }
  static async ensureSessions(from = new Date(), days = 21): Promise<void> {
    const venues = await db.marketVenue.findMany({
      where: { active: true },
      select: { id: true },
    });
    for (const { id } of venues) {
      await db.$transaction(
        async (tx) => {
          // Shared with schedule mutations. READ COMMITTED is intentional: a reader
          // that waits for the venue lock must see the newly committed child rules.
          await tx.$queryRaw`SELECT id FROM "MarketVenue" WHERE id=${id} FOR UPDATE`;
          const venue = await tx.marketVenue.findUnique({
            where: { id },
            include: { rules: true, exceptions: true },
          });
          if (!venue?.active) return;
          const sessions = generateSessions({
            timezone: venue.timezone,
            rules: venue.rules,
            exceptions: venue.exceptions,
            from,
            days,
          });
          if (sessions.length)
            await tx.marketSession.createMany({
              data: sessions.map((session) => ({
                ...session,
                marketId: venue.id,
                demoBatchId: venue.demoBatchId,
              })),
              skipDuplicates: true,
            });
        },
        { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 20_000 },
      );
    }
    // Never update existing rows here: admin cancellation is a durable decision.
  }
}
