import { db } from "@/lib/db";
import { transaction } from "./transactions";
import { assertOwner, assertAdmin, type Actor } from "@/lib/permissions";
import { invariant } from "@/lib/errors";
import type { z } from "zod";
import { attendanceSchema } from "@/lib/validation";
export class AttendanceService {
  static async save(
    actor: Actor,
    input: z.infer<typeof attendanceSchema>,
    verified?: boolean,
    reusePermission = false,
  ) {
    const data = attendanceSchema.parse(input);
    return transaction(async (tx) => {
      const registration = await tx.systemSetting.findUnique({
        where: { key: "marketRegistrationEnabled" },
      });
      invariant(
        registration?.value !== false ||
          ["ADMIN", "SUPERADMIN"].includes(actor.role),
        "การลงทะเบียนตลาดปิดชั่วคราว",
        409,
      );
      const store = await tx.store.findUniqueOrThrow({
        where: { id: data.storeId },
      });
      assertOwner(actor, store);
      invariant(!store.suspended, "ร้านถูกระงับ", 403);
      const session = await tx.marketSession.findUniqueOrThrow({
        where: { id: data.sessionId },
        include: { market: true },
      });
      invariant(
        ["SCHEDULED", "OPEN"].includes(session.status) &&
          session.endsAt > new Date() &&
          session.market.active,
        "รอบตลาดนี้ไม่เปิดให้เลือกล็อก",
        409,
      );
      const stall = await tx.marketStall.findUniqueOrThrow({
        where: { id: data.stallId },
        include: { zone: true },
      });
      invariant(
        stall.marketId === session.marketId &&
          stall.zone.marketId === session.marketId &&
          stall.active,
        "ล็อกไม่อยู่ในตลาดนี้หรือปิดใช้งาน",
      );
      if (verified !== undefined) assertAdmin(actor);
      if (data.status === "OPEN")
        invariant(
          session.startsAt <= new Date() && session.endsAt > new Date(),
          "ยังไม่ถึงเวลาเปิดตลาด",
          409,
        );
      // Lock a stall across all sessions; the exclusion constraint is the final cross-process guard.
      await tx.$queryRaw`SELECT id FROM "MarketStall" WHERE id=${stall.id} FOR UPDATE`;
      const previous = await tx.storeAttendance.findUnique({
        where: { storeId_sessionId: { storeId: store.id, sessionId: session.id } },
        include: { assignment: { include: { stall: { include: { zone: true } } } } },
      });
      // PATCH status edits may reuse the existing permission, but must not turn
      // into an unacknowledged move when another request changes the assignment.
      if (reusePermission)
        invariant(
          previous?.authorized && previous.assignment?.stallId === stall.id,
          "กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้",
        );
      const attendance = await tx.storeAttendance.upsert({
        where: {
          storeId_sessionId: { storeId: store.id, sessionId: session.id },
        },
        create: {
          storeId: store.id,
          sessionId: session.id,
          status: data.status,
          authorized: true,
          expectedArrival: data.expectedArrival,
          sellingUntil: data.sellingUntil,
        },
        update: {
          status: data.status,
          authorized: true,
          expectedArrival: data.expectedArrival,
          sellingUntil: data.sellingUntil,
        },
      });
      const released = previous?.assignment ?? null;
      await tx.stallAssignment.deleteMany({
        where: { attendanceId: attendance.id },
      });
      const attending = !["CANCELLED", "NOT_ATTENDING"].includes(data.status);
      // An unchanged merchant save must not revoke an administrator's existing
      // verification. Moving stalls or changing the interval requires re-review.
      // Admin requests retain their explicit ability to verify or unverify.
      const assignmentVerified = attending && (verified ?? (
        !!released?.verified && released.stallId === stall.id &&
        released.startsAt.getTime() === session.startsAt.getTime() &&
        released.endsAt.getTime() === session.endsAt.getTime()
      ));
      if (attending) {
        const conflict = await tx.stallAssignment.findFirst({
          where: {
            stallId: stall.id,
            startsAt: { lt: session.endsAt },
            endsAt: { gt: session.startsAt },
          },
        });
        invariant(!conflict, "ล็อกนี้ถูกเลือกไปแล้ว กรุณาเลือกล็อกอื่น", 409);
        await tx.stallAssignment.create({
          data: {
            attendanceId: attendance.id,
            stallId: stall.id,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            verified: assignmentVerified,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ATTENDANCE_SAVED",
          target: attendance.id,
          changes: {
            stallId: stall.id,
            status: data.status,
            verified: assignmentVerified,
            releasedAssignment: released
              ? {
                  id: released.id,
                  attendanceId: attendance.id,
                  storeId: store.id,
                  stallId: released.stallId,
                  stallCode: released.stall.code,
                  zoneName: released.stall.zone.name,
                  startsAt: released.startsAt.toISOString(),
                  endsAt: released.endsAt.toISOString(),
                  verified: released.verified,
                }
              : null,
          },
        },
      });
      return attendance;
    });
  }
  static async update(
    actor: Actor,
    id: string,
    input: Record<string, unknown>,
    admin = false,
  ) {
    const row = await db.storeAttendance.findUniqueOrThrow({
      where: { id },
      include: { assignment: true, store: { select: { ownerId: true } } },
    });
    if (admin) assertAdmin(actor);
    assertOwner(actor, row.store);
    const reusePermission = !admin && input.authorized !== true;
    if (!admin) {
      invariant(input.authorized === undefined || input.authorized === true, "กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้");
      invariant(
        !reusePermission || (row.authorized &&
          (typeof input.stallId !== "string" || input.stallId === row.assignment?.stallId)),
        "กรุณายืนยันว่ามีสิทธิ์ใช้ล็อกนี้",
      );
    }
    return this.save(
      actor,
      {
        storeId: row.storeId,
        sessionId: row.sessionId,
        stallId:
          typeof input.stallId === "string"
            ? input.stallId
            : (row.assignment?.stallId ?? ""),
        authorized: true,
        status: (input.status ?? row.status) as z.infer<
          typeof attendanceSchema
        >["status"],
      },
      admin && typeof input.verified === "boolean" ? input.verified : undefined,
      reusePermission,
    );
  }
}
