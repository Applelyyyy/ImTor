import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
import { date } from "@/components/marketplace";
export default async function Attendance() {
  await requireAdmin();
  const rows = await db.storeAttendance.findMany({
    take: 150,
    include: {
      store: true,
      session: { include: { market: true } },
      assignment: { include: { stall: true } },
    },
    orderBy: { session: { startsAt: "desc" } },
  });
  return (
    <AdminTable
      title="ร้านที่ออกขาย"
      description="ตรวจสอบการเข้าร่วมและยืนยันตำแหน่งที่มีหลักฐานจากผู้ดูแลตลาด"
      headers={["ร้าน", "ตลาดและวัน", "ล็อก", "สถานะ", "จัดการ"]}
      rows={rows.map((r) => [
        r.store.name,
        <div key="market">
          {r.session.market.name}
          <small className="block">
            {date(r.session.startsAt.toISOString())}
          </small>
        </div>,
        r.assignment?.stall.code || "ยังไม่มีล็อก",
        <div key="status">
          {r.status}
          <small className="block">
            {r.assignment?.verified ? "ยืนยันตำแหน่งแล้ว" : "ร้านแจ้งเอง"}
          </small>
        </div>,
        <div className="actions" key="actions">
          {r.assignment && (
            <ApiButton
              endpoint={`/api/admin/attendance/${r.id}`}
              body={{ verified: !r.assignment.verified }}
            >
              {r.assignment.verified ? "ถอนยืนยัน" : "ยืนยันตำแหน่ง"}
            </ApiButton>
          )}
          <ApiButton
            endpoint={`/api/admin/attendance/${r.id}`}
            body={{ status: "CANCELLED" }}
            confirmMessage="ยกเลิกการเข้าร่วมของร้านนี้?"
          >
            ยกเลิกเข้าร่วม
          </ApiButton>
        </div>,
      ])}
    />
  );
}
