import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { date, time } from "@/components/marketplace";
export default async function AuditLogs() {
  await requireAdmin();
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return (
    <AdminTable
      title="บันทึกการจัดการ"
      description="150 การเปลี่ยนแปลงล่าสุด เพื่อการตรวจสอบย้อนหลัง"
      headers={["เวลา", "ผู้ดำเนินการ", "การกระทำ", "เป้าหมาย"]}
      rows={rows.map((r) => [
        `${date(r.createdAt.toISOString())} ${time(r.createdAt.toISOString())}`,
        <span key="actor" className="break-all">
          {r.actorId}
        </span>,
        r.action,
        <span key="target" className="break-all">
          {r.target}
        </span>,
      ])}
    />
  );
}
