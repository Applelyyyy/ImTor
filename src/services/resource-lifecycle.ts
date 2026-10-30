import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { assertAdmin, type Actor } from "@/lib/permissions";
import { invariant } from "@/lib/errors";
import { transaction } from "./transactions";
export type ResourceKind = "market" | "zone" | "stall";
async function inspect(
  tx: Prisma.TransactionClient,
  kind: ResourceKind,
  id: string,
) {
  const counts: Record<string, number> = {};
  let name = "";
  if (kind === "market") {
    const row = await tx.marketVenue.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            zones: true,
            stalls: true,
            rules: true,
            exceptions: true,
            sessions: true,
            templates: true,
          },
        },
      },
    });
    name = row.name;
    Object.assign(counts, {
      โซน: row._count.zones,
      ล็อก: row._count.stalls,
      กฎวันเปิด: row._count.rules,
      วันพิเศษ: row._count.exceptions,
      รอบตลาดและประวัติ: row._count.sessions,
      ร้านประจำ: row._count.templates,
    });
  } else if (kind === "zone") {
    const row = await tx.marketZone.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { stalls: true } } },
    });
    name = row.name;
    counts["ล็อกในโซน"] = row._count.stalls;
  } else {
    const row = await tx.marketStall.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    name = row.code;
    counts["ประวัติการจัดสรรล็อก"] = row._count.assignments;
    counts["ร้านที่ตั้งล็อกประจำ"] = await tx.attendanceTemplate.count({
      where: { marketId: row.marketId, preferredCode: row.code },
    });
  }
  const blockers = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count} รายการ`);
  return { id, kind, name, canDelete: blockers.length === 0, blockers, counts };
}
export class ResourceLifecycleService {
  static async preview(actor: Actor, kind: ResourceKind, id: string) {
    assertAdmin(actor);
    z.enum(["market", "zone", "stall"]).parse(kind);
    return db.$transaction((tx) => inspect(tx, kind, id));
  }
  static async remove(
    actor: Actor,
    kind: ResourceKind,
    id: string,
    input: unknown,
  ) {
    assertAdmin(actor);
    z.enum(["market", "zone", "stall"]).parse(kind);
    const { confirmName } = z
      .object({ confirmName: z.string().trim().min(1).max(200) })
      .parse(input);
    return transaction(async (tx) => {
      // Rare destructive operations block concurrent child writes before checking cascades.
      await tx.$executeRaw`LOCK TABLE "MarketVenue", "MarketZone", "MarketStall", "MarketScheduleRule", "MarketScheduleException", "MarketSession", "StoreAttendance", "StallAssignment", "AttendanceTemplate", "Product" IN SHARE ROW EXCLUSIVE MODE`;
      const preview = await inspect(tx, kind, id);
      invariant(
        confirmName === preview.name.trim(),
        "กรอกชื่อให้ตรงก่อนลบ",
        400,
      );
      invariant(
        preview.canDelete,
        `ลบไม่ได้: ${preview.blockers.join(", ")} กรุณาปิดใช้งานแทนเพื่อเก็บประวัติ`,
        409,
      );
      if (kind === "market") await tx.marketVenue.delete({ where: { id } });
      else if (kind === "zone") await tx.marketZone.delete({ where: { id } });
      else await tx.marketStall.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `${kind.toUpperCase()}_DELETED`,
          target: id,
          changes: { name: preview.name, dependencyCounts: preview.counts },
        },
      });
      return { deleted: true, id };
    });
  }
}
