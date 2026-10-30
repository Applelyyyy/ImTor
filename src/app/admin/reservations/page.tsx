import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
import { money } from "@/lib/utils";
import { statusLabel, date, time } from "@/components/marketplace";
export default async function Reservations() {
  await requireAdmin();
  const rows = await db.reservation.findMany({
    take: 150,
    orderBy: { createdAt: "desc" },
    include: { user: true, product: { include: { store: true } } },
  });
  return (
    <>
      <AdminTable
        title="การจองทั้งหมด"
        description="ราคาในการจองเป็นราคาที่ยืนยันตอนจอง ไม่เปลี่ยนตามส่วนลดภายหลัง"
        headers={[
          "สินค้า / ร้าน",
          "ลูกค้า",
          "จำนวน / รวม",
          "สถานะ",
          "หมดเวลารับ",
        ]}
        rows={rows.map((r) => [
          <div key="product">
            {r.product.name}
            <small className="block">{r.product.store.name}</small>
          </div>,
          r.user.name || "ไม่ระบุ",
          `${r.quantity} / ${money(r.quantity * r.unitPrice)}`,
          statusLabel[r.status] || r.status,
          `${date(r.expiresAt.toISOString())} ${time(r.expiresAt.toISOString())}`,
        ])}
      />
      <div className="mt-6">
        <ApiButton endpoint="/api/admin/expire" method="POST">
          ประมวลผลรายการจองหมดเวลา
        </ApiButton>
      </div>
    </>
  );
}
