import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
import { DemoPricePreview } from "@/components/demo-control-panel";
import { money } from "@/lib/utils";
export default async function Products() {
  await requireAdmin();
  const total = await db.product.count();
  const rows = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { store: true, reports: { where: { status: "OPEN" } } },
  });
  return (
    <AdminTable
      title="จัดการสินค้า"
      description="ตรวจสอบราคา การแสดงผล และรายงานปัญหา"
      headers={["สินค้า", "ร้าน", "ราคา", "รายงาน", "จัดการ", "จำลองราคา"]}
      total={total}
      searchValues={rows.map((r) => `${r.id} ${r.name} ${r.store.name} ${r.archived ? "คลัง" : ""} ${r.demoBatchId ? "สาธิต" : "จริง"}`)}
      rows={rows.map((r) => [
        <div key="name">
          {r.published && !r.archived && !r.store.hidden && !r.store.suspended ? <Link href={`/product/${r.id}`}>{r.name}</Link> : <strong>{r.name}</strong>}
          {r.demoBatchId ? " · สาธิต" : ""}{r.archived ? " · เก็บเข้าคลัง" : ""}
          <small className="help-text block">{r.id}</small>
        </div>,
        r.store.name,
        money(r.price),
        <div key="reports">
          {r.reports.map((x) => (
            <p key={x.id}>{x.reason}</p>
          ))}
          {!r.reports.length ? "—" : ""}
        </div>,
        <div className="actions" key="actions">
          <ApiButton
            endpoint={`/api/admin/products/${r.id}`}
            body={{ published: !r.published }}
          >
            {r.published ? "ซ่อน" : "เผยแพร่"}
          </ApiButton>
          <ApiButton
            endpoint={`/api/admin/products/${r.id}`}
            body={{ archived: !r.archived }}
          >
            {r.archived ? "นำกลับ" : "เก็บเข้าคลัง"}
          </ApiButton>
        </div>,
        <DemoPricePreview key="pricing" productId={r.id} />,
      ])}
    />
  );
}
