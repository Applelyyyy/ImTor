import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { generateSessions, MarketScheduleService } from "@/services/schedule";
const rule = {
  weekday: 1,
  opens: "16:00",
  closes: "21:00",
  intervalWeeks: 1,
  anchorDate: "2026-01-05",
  active: true,
};
describe("market calendar: authoritative zoned sessions", () => {
  it("builds weekly local dates in Bangkok and includes previous-day overnight sessions", () => {
    const sessions = generateSessions({
      timezone: "Asia/Bangkok",
      rules: [{ ...rule, weekday: 0, opens: "22:00", closes: "02:00" }, rule],
      exceptions: [],
      from: new Date("2026-01-05T00:00:00Z"),
      days: 1,
    });
    expect(
      sessions.map((s) => [
        s.date,
        s.startsAt.toISOString(),
        s.endsAt.toISOString(),
      ]),
    ).toEqual([
      ["2026-01-04", "2026-01-04T15:00:00.000Z", "2026-01-04T19:00:00.000Z"],
      ["2026-01-05", "2026-01-05T09:00:00.000Z", "2026-01-05T14:00:00.000Z"],
    ]);
  });
  it("uses explicit Monday biweekly anchors instead of calendar week numbers", () => {
    const sessions = generateSessions({
      timezone: "Asia/Bangkok",
      rules: [{ ...rule, intervalWeeks: 2 }],
      exceptions: [],
      from: new Date("2026-01-12T05:00:00Z"),
      days: 8,
    });
    expect(sessions.map((s) => s.date)).toEqual(["2026-01-19"]);
  });
  it("applies closures and one-off hours without inventing normal opening", () => {
    const sessions = generateSessions({
      timezone: "Asia/Bangkok",
      rules: [rule],
      exceptions: [
        { date: "2026-01-05", cancelled: true },
        {
          date: "2026-01-06",
          cancelled: false,
          opens: "10:00",
          closes: "12:00",
        },
      ],
      from: new Date("2026-01-05T05:00:00Z"),
      days: 2,
    });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].status).toBe("CANCELLED");
    expect(sessions[1].startsAt.toISOString()).toBe("2026-01-06T03:00:00.000Z");
  });
  it("handles DST using the IANA zone rather than fixed offsets", () => {
    const sessions = generateSessions({
      timezone: "America/New_York",
      rules: [{ ...rule, weekday: 0, opens: "01:00", closes: "04:00" }],
      exceptions: [],
      from: new Date("2026-03-08T12:00:00Z"),
      days: 1,
    });
    expect(sessions[0].startsAt.toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(sessions[0].endsAt.toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });
  it("rejects invalid hours, anchors, zones and multiple sessions on one weekday", () => {
    const input = {
      timezone: "Asia/Bangkok",
      rules: [rule],
      exceptions: [],
      from: new Date("2026-01-05T00:00:00Z"),
      days: 1,
    };
    expect(() =>
      generateSessions({
        ...input,
        rules: [{ ...rule, anchorDate: "2026-01-06" }],
      }),
    ).toThrow();
    expect(() =>
      generateSessions({ ...input, rules: [{ ...rule, opens: "25:00" }] }),
    ).toThrow();
    expect(() =>
      generateSessions({ ...input, timezone: "Mars/Olympus" }),
    ).toThrow();
    expect(() => generateSessions({ ...input, rules: [rule, rule] })).toThrow();
  });
  it("does not mistake stored OPEN for open before/after the actual interval", () => {
    const session = {
      startsAt: "2026-01-05T09:00:00Z",
      endsAt: "2026-01-05T14:00:00Z",
      status: "OPEN",
    };
    expect(
      MarketScheduleService.status(session, new Date("2026-01-05T08:59:59Z")),
    ).toBe("SCHEDULED");
    expect(
      MarketScheduleService.status(session, new Date(session.startsAt)),
    ).toBe("OPEN");
    expect(
      MarketScheduleService.status(session, new Date(session.endsAt)),
    ).toBe("FINISHED");
    expect(
      MarketScheduleService.status(
        { ...session, status: "CANCELLED" },
        new Date(session.startsAt),
      ),
    ).toBe("CANCELLED");
  });
});
