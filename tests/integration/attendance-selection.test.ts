import "./guard";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const apiSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("next-auth", () => ({ getServerSession: async () => apiSession.userId ? { user: { id: apiSession.userId } } : null }));
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { AttendanceService } from "@/services/attendance";
import { attendanceSelection } from "@/lib/attendance-selection";
import { GET, POST, PATCH } from "@/app/api/[...path]/route";

const tag = `selection-${randomUUID()}`;
let owner: Awaited<ReturnType<typeof db.user.create>>;
let outsider: typeof owner;
let store: Awaited<ReturnType<typeof db.store.create>>;
let otherStore: typeof store;
let market: Awaited<ReturnType<typeof db.marketVenue.create>>;
let stall: Awaited<ReturnType<typeof db.marketStall.create>>;
const sessions: Awaited<ReturnType<typeof db.marketSession.create>>[] = [];

describe("merchant visual attendance selection", () => {
  beforeAll(async () => {
    owner = await db.user.create({ data: { email: `${tag}@example.invalid` } });
    outsider = await db.user.create({ data: { email: `${tag}-other@example.invalid` } });
    store = await db.store.create({ data: { ownerId: owner.id, name: tag, slug: tag } });
    otherStore = await db.store.create({ data: { ownerId: outsider.id, name: `${tag}-private-store`, slug: `${tag}-private-store`, hidden: true } });
    market = await db.marketVenue.create({ data: { name: tag, slug: tag } });
    const zone = await db.marketZone.create({ data: { marketId: market.id, name: "A" } });
    stall = await db.marketStall.create({ data: { marketId: market.id, zoneId: zone.id, code: "A01", x: 0.2, y: 0.3 } });
    for (const [index, status] of ["SCHEDULED", "FINISHED", "CLOSED", "CANCELLED"].entries()) {
      sessions.push(await db.marketSession.create({ data: {
        marketId: market.id, date: `2099-03-${index + 10}`, status,
        startsAt: new Date(Date.now() + 60_000), endsAt: new Date(Date.now() + 3_600_000),
      } }));
    }
  });

  afterAll(async () => {
    await db.rateLimit.deleteMany({ where: { OR: [owner?.id, outsider?.id].filter(Boolean).map((id) => ({ key: { startsWith: `${id}:attendance:` } })) } });
    await db.marketVenue.deleteMany({ where: { id: market?.id } });
    await db.store.deleteMany({ where: { ownerId: { in: [owner?.id, outsider?.id].filter(Boolean) } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: [owner?.id, outsider?.id].filter(Boolean) } } });
    await db.user.deleteMany({ where: { id: { in: [owner?.id, outsider?.id].filter(Boolean) } } });
    await db.$disconnect();
  });

  it.each(["FINISHED", "CLOSED", "CANCELLED"])("rejects explicitly %s sessions even before endsAt", async (status) => {
    const session = sessions.find((row) => row.status === status)!;
    await expect(AttendanceService.save(owner, {
      storeId: store.id, sessionId: session.id, stallId: stall.id, authorized: true, status: "SCHEDULED",
    })).rejects.toThrow("รอบตลาดนี้ไม่เปิดให้เลือกล็อก");
    expect(await db.storeAttendance.count({ where: { sessionId: session.id } })).toBe(0);
  });

  it("authorizes the owned store before returning selection data", async () => {
    await expect(attendanceSelection(outsider, store.id)).rejects.toThrow("ไม่มีสิทธิ์จัดการร้านนี้");
    await expect(attendanceSelection({ ...owner, suspended: true }, store.id)).rejects.toThrow("บัญชีถูกระงับ");
  });

  it("returns real geometry, own assignment and private overlapping occupancy without leaking personal data", async () => {
    await AttendanceService.save(owner, {
      storeId: store.id, sessionId: sessions[0].id, stallId: stall.id, authorized: true, status: "SCHEDULED",
    });
    const occupied = await db.marketStall.create({ data: {
      marketId: market.id, zoneId: stall.zoneId, code: "A02", x: 0.5, y: 0.4,
    } });
    await db.marketStall.create({ data: {
      marketId: market.id, zoneId: stall.zoneId, code: "DISABLED", x: 0.8, y: 0.5, active: false,
    } });
    // Persisted assignment from another overlapping session blocks the stall,
    // even if its store is hidden and the session was closed afterwards.
    const otherAttendance = await db.storeAttendance.create({ data: {
      storeId: otherStore.id, sessionId: sessions[2].id, status: "CLOSED", authorized: true,
    } });
    await db.stallAssignment.create({ data: {
      attendanceId: otherAttendance.id, stallId: occupied.id,
      startsAt: sessions[2].startsAt, endsAt: sessions[2].endsAt, verified: true,
    } });
    await db.marketSession.create({ data: {
      marketId: market.id, date: "2099-04-01", status: "SCHEDULED",
      startsAt: new Date(Date.now() - 120_000), endsAt: new Date(Date.now() - 60_000),
    } });
    const dto = await attendanceSelection(owner, store.id);
    const selected = dto.markets.find((row) => row.id === market.id)!;
    expect(selected.zones).toEqual([{ id: stall.zoneId, name: "A" }]);
    expect(selected.sessions).toHaveLength(1);
    expect(selected.sessions[0]).toMatchObject({ id: sessions[0].id, status: "SCHEDULED", currentAttendance: {
      status: "SCHEDULED", stallId: stall.id, verified: false,
    } });
    expect(selected.stalls.find((row) => row.id === stall.id)).toMatchObject({ x: 0.2, y: 0.3, zone: "A", assignments: [
      { sessionId: sessions[0].id, own: true, verified: false },
    ] });
    expect(selected.stalls.find((row) => row.id === occupied.id)?.assignments).toEqual([{
      sessionId: sessions[2].id, startsAt: sessions[2].startsAt.toISOString(), endsAt: sessions[2].endsAt.toISOString(),
      own: false, verified: true, store: null,
    }]);
    expect(selected.stalls.find((row) => row.code === "DISABLED")?.active).toBe(false);
    expect(JSON.stringify(dto)).not.toContain(owner.email);
    expect(JSON.stringify(dto)).not.toContain(outsider.email);
    expect(JSON.stringify(dto)).not.toContain(otherStore.name);
    expect(JSON.stringify(dto)).not.toContain('"ownerId"');
    await expect(AttendanceService.save(owner, {
      storeId: store.id, sessionId: sessions[0].id, stallId: occupied.id, authorized: true, status: "SCHEDULED",
    })).rejects.toThrow("ล็อกนี้ถูกเลือกไปแล้ว กรุณาเลือกล็อกอื่น");
    expect(await db.stallAssignment.findFirst({ where: { attendance: { storeId: store.id, sessionId: sessions[0].id } } }))
      .toMatchObject({ stallId: stall.id });
  });

  it("preserves explicit permission, ownership and stall eligibility on save", async () => {
    const input = { storeId: store.id, sessionId: sessions[0].id, stallId: stall.id, authorized: true as const, status: "SCHEDULED" as const };
    await expect(AttendanceService.save(outsider, input)).rejects.toThrow("ไม่มีสิทธิ์จัดการร้านนี้");
    await expect(AttendanceService.save(owner, { ...input, authorized: false as never })).rejects.toThrow();
    const inactive = await db.marketStall.findFirstOrThrow({ where: { marketId: market.id, active: false } });
    await expect(AttendanceService.save(owner, { ...input, stallId: inactive.id })).rejects.toThrow("ล็อกไม่อยู่ในตลาดนี้หรือปิดใช้งาน");
  });

  it("serializes simultaneous exclusive claims and keeps a single attendance per store/session", async () => {
    const contested = await db.marketStall.create({ data: {
      marketId: market.id, zoneId: stall.zoneId, code: "RACE", x: 0.5, y: 0.6,
    } });
    const results = await Promise.allSettled([
      AttendanceService.save(owner, { storeId: store.id, sessionId: sessions[0].id, stallId: contested.id, authorized: true, status: "SCHEDULED" }),
      AttendanceService.save(outsider, { storeId: otherStore.id, sessionId: sessions[0].id, stallId: contested.id, authorized: true, status: "SCHEDULED" }),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(await db.stallAssignment.count({ where: { stallId: contested.id } })).toBe(1);
    expect(await db.storeAttendance.count({ where: { storeId: store.id, sessionId: sessions[0].id } })).toBe(1);
  });


  it("rejects expired sessions and inactive venues without modifying the current assignment", async () => {
    const expired = await db.marketSession.findFirstOrThrow({ where: { marketId: market.id, endsAt: { lt: new Date() } } });
    const input = { storeId: store.id, sessionId: expired.id, stallId: stall.id, authorized: true as const, status: "SCHEDULED" as const };
    await expect(AttendanceService.save(owner, input)).rejects.toThrow("รอบตลาดนี้ไม่เปิดให้เลือกล็อก");
    await db.marketVenue.update({ where: { id: market.id }, data: { active: false } });
    try {
      await expect(AttendanceService.save(owner, { ...input, sessionId: sessions[0].id })).rejects.toThrow("รอบตลาดนี้ไม่เปิดให้เลือกล็อก");
      expect((await attendanceSelection(owner, store.id)).markets.find((row) => row.id === market.id)).toBeUndefined();
    } finally {
      await db.marketVenue.update({ where: { id: market.id }, data: { active: true } });
    }
  });

  it("returns active sessions and preserves the current attendance status for editing", async () => {
    const active = await db.marketSession.create({ data: {
      marketId: market.id, date: "2099-04-02", status: "OPEN",
      startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
    } });
    const openStall = await db.marketStall.create({ data: {
      marketId: market.id, zoneId: stall.zoneId, code: "OPEN", x: 0.6, y: 0.7,
    } });
    const attendance = await AttendanceService.save(owner, {
      storeId: store.id, sessionId: active.id, stallId: openStall.id, authorized: true, status: "OPEN",
    });
    const dto = await attendanceSelection(owner, store.id);
    expect(dto.markets.find((row) => row.id === market.id)?.sessions.find((row) => row.id === active.id)).toMatchObject({
      status: "OPEN", currentAttendance: { id: attendance.id, status: "OPEN", stallId: openStall.id, verified: false },
    });
  });


  it("retains official verification only when a merchant saves the unchanged stall and interval", async () => {
    const verifiedStall = await db.marketStall.create({ data: { marketId: market.id, zoneId: stall.zoneId, code: "VERIFIED", x: 0.3, y: 0.8 } });
    const replacement = await db.marketStall.create({ data: { marketId: market.id, zoneId: stall.zoneId, code: "REPLACEMENT", x: 0.5, y: 0.8 } });
    const input = { storeId: store.id, sessionId: sessions[0].id, stallId: verifiedStall.id, authorized: true as const, status: "SCHEDULED" as const };
    const attendance = await AttendanceService.save({ ...owner, role: "ADMIN" }, input, true);
    await AttendanceService.save({ ...owner, role: "ADMIN" }, input);
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ verified: true });
    await AttendanceService.save({ ...owner, role: "ADMIN" }, input, false);
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ verified: false });
    await AttendanceService.save({ ...owner, role: "ADMIN" }, input, true);
    await expect(AttendanceService.save(owner, input, true)).rejects.toThrow("เฉพาะผู้ดูแลระบบ");
    await AttendanceService.save(owner, input);
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ verified: true });
    await AttendanceService.save(owner, { ...input, stallId: replacement.id });
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ stallId: replacement.id, verified: false });
    await AttendanceService.save({ ...owner, role: "ADMIN" }, input, true);
    await db.marketSession.update({ where: { id: sessions[0].id }, data: { endsAt: new Date(sessions[0].endsAt.getTime() + 60_000) } });
    await AttendanceService.save(owner, input);
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ verified: false });
  });

  it.each(["CANCELLED", "NOT_ATTENDING"] as const)("rejoins a %s attendance without duplicating its session record", async (status) => {
    const input = { storeId: store.id, sessionId: sessions[0].id, stallId: stall.id, authorized: true as const, status: "SCHEDULED" as const };
    const cancelled = await AttendanceService.save(owner, { ...input, status });
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: cancelled.id } })).toBeNull();
    const rejoined = await AttendanceService.save(owner, input);
    expect(rejoined).toMatchObject({ id: cancelled.id, status: "SCHEDULED" });
    expect(await db.storeAttendance.count({ where: { storeId: store.id, sessionId: sessions[0].id } })).toBe(1);
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: rejoined.id } })).toMatchObject({ stallId: stall.id, verified: false });
  });

  it("materializes an upcoming recurrence for a direct selector visit without reopening canceled sessions", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(tomorrow);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    await db.marketScheduleRule.create({ data: { marketId: market.id, weekday, opens: "08:00", closes: "20:00" } });
    const before = await db.marketSession.findUnique({ where: { marketId_date: { marketId: market.id, date } } });
    expect(before).toBeNull();
    const dto = await attendanceSelection(owner, store.id);
    const generated = dto.markets.find((row) => row.id === market.id)?.sessions.find((row) => row.date === date);
    expect(generated).toBeDefined();
    await db.marketSession.update({ where: { id: generated!.id }, data: { status: "CANCELLED" } });
    const refreshed = await attendanceSelection(owner, store.id);
    expect(refreshed.markets.find((row) => row.id === market.id)?.sessions.find((row) => row.id === generated!.id)).toBeUndefined();
    expect(await db.marketSession.findUnique({ where: { id: generated!.id } })).toMatchObject({ status: "CANCELLED" });
  });

  it("authenticates selector API access and returns fieldless Thai attendance validation errors", async () => {
    const origin = new URL(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3100").origin;
    const selectionRequest = () => GET(new Request(`${origin}/api/attendance/selection?storeId=${store.id}`), { params: Promise.resolve({ path: ["attendance", "selection"] }) });
    apiSession.userId = "";
    expect((await selectionRequest()).status).toBe(401);
    apiSession.userId = outsider.id;
    expect((await selectionRequest()).status).toBe(403);
    apiSession.userId = owner.id;
    expect((await selectionRequest()).status).toBe(200);
    const request = (body: unknown, path: string[]) => new Request(`${origin}/api/${path.join("/")}`, {
      method: path.length === 1 ? "POST" : "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    for (const body of [{ authorized: false }, { storeId: store.id, sessionId: sessions[0].id, stallId: stall.id, authorized: true, status: "BOGUS" }]) {
      const response = await POST(request(body, ["attendance"]), { params: Promise.resolve({ path: ["attendance"] }) });
      expect(response.status).toBe(400);
      const text = JSON.stringify(await response.json());
      expect(text).toMatch(/[ก-๙]/);
      expect(text).not.toMatch(/authorized|storeId|sessionId|stallId|status|Invalid|expected/);
    }
    const attendance = await db.storeAttendance.findUniqueOrThrow({ where: { storeId_sessionId: { storeId: store.id, sessionId: sessions[0].id } } });
    const path = ["attendance", attendance.id];
    const response = await PATCH(request({ status: "BOGUS" }, path), { params: Promise.resolve({ path }) });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toMatch(/status|Invalid|expected/);
    await db.rateLimit.deleteMany({ where: { key: { startsWith: `${owner.id}:attendance:` } } });
  });

  it("requires a fresh permission acknowledgement for merchant PATCH moves but reuses prior permission for status-only edits", async () => {
    const origin = new URL(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3100").origin;
    const patchStall = await db.marketStall.create({ data: { marketId: market.id, zoneId: stall.zoneId, code: "PATCH", x: 0.7, y: 0.8 } });
    const attendance = await db.storeAttendance.findUniqueOrThrow({ where: { storeId_sessionId: { storeId: store.id, sessionId: sessions[0].id } } });
    await expect(AttendanceService.update(owner, attendance.id, { stallId: patchStall.id })).rejects.toThrow("กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้");
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ stallId: stall.id });
    await expect(AttendanceService.save(owner, {
      storeId: store.id, sessionId: sessions[0].id, stallId: patchStall.id, status: "SCHEDULED", authorized: true,
    }, undefined, true)).rejects.toThrow("กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้");
    apiSession.userId = owner.id;
    const patch = (body: Record<string, unknown>) => PATCH(new Request(`${origin}/api/attendance/${attendance.id}`, {
      method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ path: ["attendance", attendance.id] }) });
    for (const authorized of [undefined, false]) {
      const response = await patch({ stallId: patchStall.id, authorized });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { message: "กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้" } });
    }
    expect((await patch({ stallId: patchStall.id, authorized: true })).status).toBe(200);
    expect(await db.stallAssignment.findUnique({ where: { attendanceId: attendance.id } })).toMatchObject({ stallId: patchStall.id });
    expect((await patch({ stallId: patchStall.id })).status).toBe(200);
    expect((await patch({ status: "CLOSED" })).status).toBe(200);
    expect(await db.storeAttendance.findUnique({ where: { id: attendance.id } })).toMatchObject({ status: "CLOSED", authorized: true });
    await expect(AttendanceService.update({ ...owner, role: "ADMIN" }, attendance.id, { stallId: stall.id }, true)).resolves.toMatchObject({ id: attendance.id });
    await db.storeAttendance.update({ where: { id: attendance.id }, data: { authorized: false } });
    await expect(AttendanceService.update(owner, attendance.id, { status: "SCHEDULED" })).rejects.toThrow("กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้");
    await expect(AttendanceService.update(owner, attendance.id, { status: "SCHEDULED", authorized: true })).resolves.toMatchObject({ authorized: true });
  });

});
