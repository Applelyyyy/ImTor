import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
export default async function Stores() {
  await requireAdmin();
  const rows = await db.store.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { owner: true },
  });
  return (
    <AdminTable
      title="ร้านค้าในชุมชน"
      description="ตรวจสอบร้านและควบคุมการแสดงผล"
      headers={["ร้าน", "เจ้าของ", "สถานะ", "จัดการ"]}
      rows={rows.map((r) => [
        <Link key="name" href={`/store/${r.slug}`}>
          {r.name}
        </Link>,
        r.owner.email,
        <span key="status">
          {r.verified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
          {r.suspended ? " · ระงับ" : ""}
          {r.hidden ? " · ซ่อน" : ""}
        </span>,
        <div key="actions" className="actions">
          <ApiButton
            endpoint={`/api/admin/stores/${r.id}`}
            body={{ verified: !r.verified }}
          >
            {r.verified ? "ถอนยืนยัน" : "ยืนยันร้าน"}
          </ApiButton>
          <ApiButton
            endpoint={`/api/admin/stores/${r.id}`}
            body={{ hidden: !r.hidden }}
          >
            {r.hidden ? "แสดงร้าน" : "ซ่อนร้าน"}
          </ApiButton>
          <ApiButton
            endpoint={`/api/admin/stores/${r.id}`}
            body={{ suspended: !r.suspended }}
          >
            {r.suspended ? "ปลดระงับ" : "ระงับ"}
          </ApiButton>
        </div>,
      ])}
    />
  );
}
