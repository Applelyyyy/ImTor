import { PickupScanner } from "@/components/pickup-scanner";
import { AdminDeleteButton } from "@/components/admin-delete-button";
import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton, ApiForm } from "@/components/forms";
import { money } from "@/lib/utils";
import { statusLabel, date, time } from "@/components/marketplace";
export default async function Reservations() {
  await requireAdmin();
  const total = await db.reservation.count();
  const rows = await db.reservation.findMany({
    take: 1000,
    orderBy: { createdAt: "desc" },
    include: { user: true, product: { include: { store: true } } },
  });
  return (
    <>
      <div className="mb-5"><PickupScanner /></div>
      <AdminTable
        title="การจองทั้งหมด"
        description="ราคาในการจองเป็นราคาที่ยืนยันตอนจอง ไม่เปลี่ยนตามส่วนลดภายหลัง"
        headers={[
          "สินค้า / ร้าน",
          "ลูกค้า",
          "จำนวน / รวม",
          "สถานะ",
          "หมดเวลารับ",
          "ยืนยันการรับ",
          "จัดการ",
        ]}
        total={total}
      searchValues={rows.map((r) => `${r.id} ${r.product.name} ${r.product.store.name} ${r.user.name ?? ""} ${r.user.email ?? ""} ${r.status} ${statusLabel[r.status] || r.status} ${r.demoBatchId ? "เตรียมไว้" : "จริง"}`)}
      rows={rows.map((r) => [
          <div key="product">
            {r.product.name}
            <small className="block">{r.product.store.name}</small>
          </div>,
          r.user.name || "ไม่ระบุ",
          `${r.quantity} / ${money(r.quantity * r.unitPrice)}`,
          statusLabel[r.status] || r.status,
          `${date(r.expiresAt.toISOString())} ${time(r.expiresAt.toISOString())}`,
          r.status === "RESERVED" ? <details key="pickup"><summary className="cursor-pointer">ยืนยันด้วยรหัสรับสินค้า</summary>
            <ApiForm endpoint={`/api/reservations/${r.id}`} method="PATCH" body={{ status: "COMPLETED" }}
              fields={[{ name: "pickupCode", label: "รหัสที่ลูกค้าแสดง", required: true }]}
              submit="ยืนยันรับสินค้า" />
            </details> : "—",
          <AdminDeleteButton key="delete" endpoint={`/api/admin/reservations/${r.id}`} name="การจองนี้" />,
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
