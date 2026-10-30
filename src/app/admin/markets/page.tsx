import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTable, marketFields } from "@/components/admin";
import { ApiForm, ApiButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
export default async function AdminMarkets() {
  await requireAdmin();
  const rows = await db.marketVenue.findMany({
    include: { _count: { select: { stalls: true, rules: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div className="stack">
      <div>
        <AdminTable
          title="ตลาดและวันเปิด"
          description="สถานที่ เวลา และผังตลาดจัดการแยกกันได้"
          headers={["ตลาด", "ประเภท", "ล็อก", "จัดการ"]}
          rows={rows.map((r) => [
            r.name,
            r.type,
            r._count.stalls,
            <div className="actions" key="actions">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/markets/${r.id}/schedule`}>
                  ตาราง / ข้อมูลตลาด
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/markets/${r.id}/layout`}>ผังและล็อก</Link>
              </Button>
              <ApiButton
                endpoint={`/api/admin/markets/${r.id}`}
                body={{ active: !r.active }}
              >
                {r.active ? "ปิดแสดงผล" : "เปิดแสดงผล"}
              </ApiButton>
            </div>,
          ])}
        />
      </div>
      <div className="form-panel">
        <h2>เพิ่มตลาดใหม่</h2>
        <ApiForm
          endpoint="/api/admin/markets"
          fields={marketFields}
          submit="สร้างตลาด"
        />
      </div>
    </div>
  );
}
