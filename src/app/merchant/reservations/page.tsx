import { merchantStore, NoStore } from "@/components/merchant";
import { reservations } from "@/lib/queries";
import {
  PageHeading,
  EmptyState,
  time,
  date,
  statusLabel,
} from "@/components/marketplace";
import { ApiButton } from "@/components/forms";
import { ContextualForm } from "@/components/contextual-form";
import { money } from "@/lib/utils";
export default async function MerchantReservations() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const rows = await reservations("", s.id);
  return (
    <>
      <PageHeading
        title="รายการจองของร้าน"
        description="ตรวจสอบรหัสรับสินค้าก่อนยืนยันส่งมอบ"
      />
      {!rows.length ? (
        <EmptyState
          title="ยังไม่มีรายการจอง"
          description="รายการจองจากสินค้าของคุณจะปรากฏที่นี่"
        />
      ) : (
        <div className="stack">
          {rows.map((r) => (
            <div className="reservation-card" key={r.id}>
              <div>
                {r.demoBatchId && <p className="help-text">การจองสาธิต · ไม่มีการซื้อขายหรือรับสินค้าจริง</p>}
                <h2>
                  {r.product.name} × {r.quantity}
                </h2>
                <p>
                  {money(r.quantity * r.unitPrice)} ·{" "}
                  {statusLabel[r.status] || r.status}
                </p>
                <p>
                  รับก่อน {date(r.expiresAt.toISOString())}{" "}
                  {time(r.expiresAt.toISOString())}
                </p>
                {r.status === "RESERVED" && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    <ApiButton
                      endpoint={`/api/reservations/${r.id}`}
                      body={{ status: "CANCELLED" }}
                      confirmMessage="ยกเลิกการจองนี้และคืนจำนวนพร้อมขาย?"
                    >
                      ยกเลิก
                    </ApiButton>
                    <ApiButton
                      endpoint={`/api/reservations/${r.id}`}
                      body={{ status: "NO_SHOW" }}
                      confirmMessage="ยืนยันว่าลูกค้าไม่มารับ? รายการนี้จะปิดและคืนจำนวนพร้อมขาย"
                    >
                      ไม่มารับ
                    </ApiButton>
                  </div>
                )}
              </div>
              {r.status === "RESERVED" && (
                <div>
                  <ContextualForm title="ยืนยันส่งมอบสินค้า" label="ยืนยันส่งมอบสินค้า"
                    endpoint={`/api/reservations/${r.id}`}
                    method="PATCH"
                    body={{ status: "COMPLETED" }}
                    fields={[
                      {
                        name: "pickupCode",
                        label: "รหัสที่ลูกค้าแสดง",
                        required: true,
                      },
                    ]}
                    submit="ยืนยันส่งมอบสินค้า"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
