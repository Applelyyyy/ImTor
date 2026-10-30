import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { assertAdmin, type Actor } from "@/lib/permissions";
import { AdminDeletionService } from "./admin-deletion";
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
  return { id, kind, name, canDelete: true, blockers: [], counts };
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
    return AdminDeletionService.remove(actor, kind, id, input);
  }
}
