import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
import { money } from "@/lib/utils";
export default async function Products() {
  await requireAdmin();
  const rows = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { store: true, reports: { where: { status: "OPEN" } } },
  });
  return (
    <AdminTable
      title="จัดการสินค้า"
      description="ตรวจสอบราคา การแสดงผล และรายงานปัญหา"
      headers={["สินค้า", "ร้าน", "ราคา", "รายงาน", "จัดการ"]}
      rows={rows.map((r) => [
        <Link key="name" href={`/product/${r.id}`}>
          {r.name}
        </Link>,
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
      ])}
    />
  );
}
