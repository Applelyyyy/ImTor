import type { AttendanceSelectionMarket } from "@/lib/contracts";

export function eligibleAttendanceSessions(market: AttendanceSelectionMarket, now = Date.now()) {
  return market.sessions.filter((session) => !["CANCELLED", "FINISHED", "CLOSED"].includes(session.status) && new Date(session.endsAt).getTime() > now);
}

export function stallSelectionState(stall: AttendanceSelectionMarket["stalls"][number], session: AttendanceSelectionMarket["sessions"][number]) {
  const overlaps = stall.assignments.filter((assignment) => new Date(assignment.startsAt) < new Date(session.endsAt) && new Date(assignment.endsAt) > new Date(session.startsAt));
  const own = overlaps.find((assignment) => assignment.own && assignment.sessionId === session.id);
  const conflict = overlaps.find((assignment) => !assignment.own || assignment.sessionId !== session.id);
  const selectable = stall.active && !conflict;
  return {
    status: !selectable ? "unavailable" as const : own ? "own" as const : "available" as const,
    selectable,
    own: !!own,
    verified: own?.verified ?? conflict?.verified ?? false,
    store: conflict?.store ?? null,
    label: !stall.active ? "ปิดใช้งาน" : conflict ? "มีร้านลงทะเบียนแล้ว" : own ? "ล็อกของคุณ" : "เลือกได้",
  };
}

export function attendanceSessionLabel(session: { startsAt: string; endsAt: string }, now = Date.now()) {
  const day = new Intl.DateTimeFormat("th-TH-u-ca-gregory", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(session.startsAt));
  const time = (value: string) => new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).format(new Date(value));
  return `${day} · ${time(session.startsAt)}–${time(session.endsAt)} · ${new Date(session.startsAt).getTime() <= now ? "กำลังเปิด" : "รอบถัดไป"}`;
}
