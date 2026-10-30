import { AdminDeleteButton } from "@/components/admin-delete-button";
import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
export default async function Stalls() {
  await requireAdmin();
  const rows = await db.marketStall.findMany({
    take: 300,
    include: { market: true, zone: true },
    orderBy: { code: "asc" },
  });
  return (
    <AdminTable
      title="โซนและล็อก"
      description="จัดการรายละเอียดและตำแหน่งผ่านผังของแต่ละตลาด"
      headers={["ตลาด", "โซน", "ล็อก", "พิกัดในผัง", "จัดการ"]}
      rows={rows.map((r) => [
        r.market.name,
        r.zone.name,
        r.code,
        `${r.x.toFixed(2)}, ${r.y.toFixed(2)}`,
        <div className="actions" key="actions">
          <Link
            className="link-button"
            href={`/admin/markets/${r.marketId}/layout`}
          >
            แก้ไขในผัง
          </Link>
          <ApiButton
            endpoint={`/api/admin/stalls/${r.id}`}
            body={{ active: !r.active }}
          >
            {r.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </ApiButton>
          <AdminDeleteButton endpoint={`/api/admin/stalls/${r.id}`} name={`ล็อก ${r.code}`} related />
        </div>,
      ])}
    />
  );
}
