import "./guard";
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { MarketScheduleService } from "@/services/schedule";
const tag = `schedule-race-${randomUUID()}`;
let preexistingSessionIds: string[] = [];
let generatedSessionIds: string[] = [];
afterAll(async () => {
  await db.marketSession.deleteMany({
    where: {
      id: { in: generatedSessionIds },
      attendances: { none: {} },
      products: { none: {} },
    },
  });
  await db.marketVenue.deleteMany({ where: { slug: tag } });
  await db.$disconnect();
});
describe("PostgreSQL schedule mutation/materialization serialization", () => {
  it("waits for the venue mutation then generates exact latest hours without reopening cancellations", async () => {
    const venue = await db.marketVenue.create({
      data: { name: tag, slug: tag, timezone: "Asia/Bangkok" },
    });
    const rule = await db.marketScheduleRule.create({
      data: {
        marketId: venue.id,
        weekday: 1,
        opens: "10:00",
        closes: "11:00",
        anchorDate: "2026-01-05",
      },
    });
    const cancelled = await db.marketSession.create({
      data: {
        marketId: venue.id,
        date: "2030-01-14",
        startsAt: new Date("2030-01-14T03:00:00Z"),
        endsAt: new Date("2030-01-14T04:00:00Z"),
        status: "CANCELLED",
      },
    });
    let locked!: () => void, release!: () => void;
    const lockReady = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const releaseMutation = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mutation = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MarketVenue" WHERE id=${venue.id} FOR UPDATE`;
        await tx.marketVenue.update({
          where: { id: venue.id },
          data: { description: "updated schedule revision" },
        });
        await tx.marketScheduleRule.update({
          where: { id: rule.id },
          data: { opens: "12:00", closes: "13:00" },
        });
        locked();
        await releaseMutation;
      },
      { timeout: 10_000 },
    );
    await lockReady;
    preexistingSessionIds = (
      await db.marketSession.findMany({
        where: { date: { gte: "2030-01-06", lte: "2030-01-14" } },
        select: { id: true },
      })
    ).map((row) => row.id);
    const generation = MarketScheduleService.ensureSessions(
      new Date("2030-01-07T05:00:00Z"),
      8,
    );
    try {
      // Observe a real PostgreSQL lock wait rather than relying on a scheduling sleep.
      let blocked = false;
      for (let attempt = 0; attempt < 200 && !blocked; attempt++) {
        const rows = await db.$queryRaw<
          { count: number }[]
        >`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND (query LIKE '%MarketVenue%' OR query LIKE '%MarketSession%')`;
        blocked = rows[0].count > 0;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
    } finally {
      release();
      await mutation;
      await generation;
      generatedSessionIds = (
        await db.marketSession.findMany({
          where: {
            date: { gte: "2030-01-06", lte: "2030-01-14" },
            id: { notIn: preexistingSessionIds },
          },
          select: { id: true },
        })
      ).map((row) => row.id);
    }
    const session = await db.marketSession.findUniqueOrThrow({
      where: { marketId_date: { marketId: venue.id, date: "2030-01-07" } },
    });
    expect(session.startsAt.toISOString()).toBe("2030-01-07T05:00:00.000Z");
    expect(session.endsAt.toISOString()).toBe("2030-01-07T06:00:00.000Z");
    expect(session.status).toBe("SCHEDULED");
    expect(
      (
        await db.marketSession.findUniqueOrThrow({
          where: { id: cancelled.id },
        })
      ).status,
    ).toBe("CANCELLED");
    expect(
      await db.marketSession.count({ where: { marketId: venue.id } }),
    ).toBe(2);
  });
});
