import Link from "next/link";
import { requireUser } from "@/components/auth-guard";
import { reservations } from "@/lib/queries";
import {
  PageHeading,
  EmptyState,
  statusLabel,
  date,
  time,
} from "@/components/marketplace";
import { ApiButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
export const metadata = { title: "การจองของฉัน" };
export default async function Reservations() {
  const user = await requireUser();
  const rows = await reservations(user.id);
  return (
    <div className="shell page">
      <PageHeading
        title="มื้ออร่อยที่จองไว้"
        description="รายการจริงใช้รหัสรับสินค้าที่ร้าน ส่วนรายการสาธิตติดป้ายชัดเจนและไม่มีการซื้อขายจริง"
      />
      {!rows.length ? (
        <EmptyState
          title="ยังไม่มีการจอง"
          description="เจอของที่ชอบแล้ว กดจองเพื่อเก็บมื้ออร่อยไว้ก่อน"
        />
      ) : (
        <div className="stack">
          {rows.map((r) => (
            <article className="reservation-card" key={r.id}>
              <div>
                <Badge
                  variant={r.status === "RESERVED" ? "default" : "secondary"}
                >
                  {statusLabel[r.status] || r.status}
                </Badge>
                {r.demoBatchId && <Badge variant="outline" className="ml-2">การจองสาธิต · ไม่ใช่การซื้อขายจริง</Badge>}
                <h2 className="mt-3">
                  <Link href={`/product/${r.productId}`}>{r.product.name}</Link>
                </h2>
                <p>
                  {r.product.store.name} · {r.quantity} ชิ้น · รวม{" "}
                  {money(r.quantity * r.unitPrice)}
                </p>
                {r.demoBatchId && <p className="help-text">ไม่ต้องเดินทางหรือชำระเงิน รหัสนี้ใช้ทดลองขั้นตอนรับสินค้าเท่านั้น</p>}
                <p>
                  {r.demoBatchId ? "หมดเวลาทดลองรับ" : "รับก่อน"} {date(r.expiresAt.toISOString())}{" "}
                  {time(r.expiresAt.toISOString())} น.
                </p>
                {r.status === "RESERVED" && (
                  <div className="mt-4">
                    <ApiButton
                      endpoint={`/api/reservations/${r.id}`}
                      body={{ status: "CANCELLED" }}
                      confirmMessage="ยืนยันยกเลิกการจองนี้?"
                    >
                      ยกเลิกการจอง
                    </ApiButton>
                  </div>
                )}
              </div>
              <div>
                <p>รหัสรับสินค้า</p>
                <strong className="pickup-code">{r.pickupCode}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
