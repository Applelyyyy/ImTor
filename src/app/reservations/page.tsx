import Link from "next/link";
import { PickupQr } from "@/components/pickup-qr";
import { ReservationsLiveSync } from "@/components/reservations-live-sync";
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
      <ReservationsLiveSync rows={rows.map(r=>({id:r.id,status:r.status,expiresAt:r.expiresAt.toISOString()}))} />
      <PageHeading
        title="มื้ออร่อยที่จองไว้"
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
                <h2 className="mt-3">
                  <Link href={`/product/${r.productId}`}>{r.product.name}</Link>
                </h2>
                <p>
                  {r.product.store.name} · {r.quantity} ชิ้น · รวม{" "}
                  {money(r.quantity * r.unitPrice)}
                </p>
                <p>
                  รับก่อน {date(r.expiresAt.toISOString())}{" "}
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
              {r.status === "RESERVED" && <div><PickupQr id={r.id} code={r.pickupCode} /></div>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
