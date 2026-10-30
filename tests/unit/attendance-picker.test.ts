import { describe, expect, it } from "vitest";
import { attendanceSessionLabel, eligibleAttendanceSessions, stallSelectionState } from "@/lib/attendance-picker";
import type { AttendanceSelectionMarket } from "@/lib/contracts";
const session = { id: "s", startsAt: "2026-11-02T01:00:00Z", endsAt: "2026-11-02T13:00:00Z", status: "SCHEDULED" } as AttendanceSelectionMarket["sessions"][number];
const stall = { active: true, assignments: [] } as unknown as AttendanceSelectionMarket["stalls"][number];
describe("merchant stall selection view", () => {
 it("distinguishes available, own, overlapping conflicts, and disabled stalls", () => {
  expect(stallSelectionState(stall, session)).toMatchObject({ selectable: true, status: "available" });
  const assignment = { sessionId: "s", startsAt: session.startsAt, endsAt: session.endsAt, own: true, verified: false, store: null };
  expect(stallSelectionState({ ...stall, assignments: [assignment] }, session)).toMatchObject({ status: "own", selectable: true, verified: false });
  expect(stallSelectionState({ ...stall, assignments: [{ ...assignment, sessionId: "other" }] }, session)).toMatchObject({ status: "unavailable", selectable: false });
  expect(stallSelectionState({ ...stall, assignments: [{ ...assignment, own: false, store: null }] }, session)).toMatchObject({ status: "unavailable", store: null });
  expect(stallSelectionState({ ...stall, active: false }, session).selectable).toBe(false);
  expect(stallSelectionState({ ...stall, assignments: [{ ...assignment, startsAt: session.endsAt, endsAt: "2026-11-02T15:00:00Z" }] }, session).selectable).toBe(true);
 });
 it("excludes ended/finished/closed/cancelled sessions even when their dates disagree", () => {
  const market = { sessions: [session, ...["CANCELLED", "FINISHED", "CLOSED"].map((status) => ({ ...session, status }))] } as AttendanceSelectionMarket;
  expect(eligibleAttendanceSessions(market, Date.parse("2026-11-02T02:00:00Z"))).toEqual([session]);
  expect(eligibleAttendanceSessions(market, Date.parse(session.endsAt))).toEqual([]);
 });
 it("formats Gregorian month/day and Bangkok08:00–20:00 without ambiguous numeric years", () => {
  const label = attendanceSessionLabel(session, Date.parse("2026-11-01T01:00:00Z"));
  expect(label).toContain("08:00–20:00"); expect(label).toContain("รอบถัดไป"); expect(label).not.toContain("2026"); expect(label).not.toContain("2569");
 });
});
