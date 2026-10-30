import Link from "next/link";
import { merchantStore, NoStore } from "@/components/merchant";
import { PageHeading, date, time } from "@/components/marketplace";
import { ApiButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
export default async function MerchantDashboard() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const count = await db.reservation.count({ where: { product: { storeId: s.id }, status: "RESERVED" } });
  const now = new Date();
  const upcoming = s.attendances.filter((a) => a.session.endsAt > now && !["CANCELLED", "NOT_ATTENDING"].includes(a.status) && !["CANCELLED", "CLOSED"].includes(a.session.status)).sort((a, b) => a.session.startsAt.getTime() - b.session.startsAt.getTime());
  const current = upcoming.find((a) => a.session.startsAt <= now);
  const next = current ?? upcoming.find((a) => a.status !== "CLOSED");
  const available = s.products.filter((p) => p.published && !p.archived && (p.stock === null || p.stock > 0)).length;
  return <>
    <PageHeading title={s.name} description="ร้านของฉัน"><Button asChild><Link href="/merchant/products/new">+ เพิ่มสินค้า</Link></Button></PageHeading>
    {s.suspended && <p className="form-error mb-5" role="alert">ร้านถูกระงับการแสดงผล กรุณาติดต่อผู้ดูแล</p>}
    {s.hidden && !s.suspended && <p className="form-error mb-5" role="status">ร้านยังไม่แสดงต่อลูกค้า กรุณาติดต่อผู้ดูแลเพื่อเปิดการแสดงผล</p>}
    {s.demoBatchId && <Badge variant="outline" className="mb-4">ร้านสาธิต · ไม่ใช่การซื้อขายจริง</Badge>}
    <section className="merchant-today content-panel">
      <div><h2>{current ? "วันนี้ขายที่นี่" : next ? "นัดขายครั้งถัดไป" : "วันนี้ขายที่ไหน?"}</h2>
        {next ? <><p className="merchant-location">{next.session.market.name}{next.assignment ? ` · ล็อก ${next.assignment.stall.code}` : " · ยังไม่เลือกล็อก"}</p><p className="help-text">{date(next.session.startsAt.toISOString())} {time(next.session.startsAt.toISOString())}–{time(next.session.endsAt.toISOString())}</p></> : <p>{s.kind !== "MARKET" ? s.address || "เพิ่มที่อยู่ร้านในตั้งค่าร้าน" : "เลือกตลาดและวันออกขายเพื่อให้ลูกค้าหาเจอ"}</p>}
      </div>
      <div className="merchant-status-actions">
        {current ? <><Badge variant={!s.hidden && !s.suspended && current.status === "OPEN" ? "default" : "secondary"}>{s.hidden || s.suspended ? "พักการแสดงผล" : current.status === "OPEN" ? "ร้านยืนยันเปิด" : current.status === "CLOSED" ? "ปิดร้านแล้ว" : "ยังไม่ยืนยันเปิด"}</Badge>{!s.hidden && !s.suspended && <ApiButton endpoint={`/api/attendance/${current.id}`} body={{ status: current.status === "OPEN" ? "CLOSED" : "OPEN", authorized: true }}>{current.status === "OPEN" ? "ปิดร้านรอบนี้" : "เปิดร้านรอบนี้"}</ApiButton>}</> : s.kind !== "MARKET" ? <><Badge variant={!s.hidden && !s.suspended && s.open ? "default" : "secondary"}>{s.hidden || s.suspended ? "พักการแสดงผล" : s.open ? "หน้าร้านเปิด" : "หน้าร้านปิด"}</Badge>{!s.hidden && !s.suspended && <ApiButton endpoint={`/api/stores/${s.id}`} body={{ open: !s.open }}>{s.open ? "ปิดหน้าร้าน" : "เปิดหน้าร้าน"}</ApiButton>}</> : <Badge variant="secondary">ยังไม่ถึงรอบขาย</Badge>}
        <Link className="link-button" href="/merchant/schedule">{next ? "เปลี่ยนวันหรือล็อก" : "เลือกวันและตลาด"}</Link>
      </div>
    </section>
    <div className="merchant-summary">
      <Link href="/merchant/products"><strong>{available}</strong><span>สินค้าพร้อมขาย</span></Link>
      <Link href="/merchant/reservations"><strong>{count}</strong><span>การจองรอรับ</span></Link>
    </div>
    <div className="merchant-next-actions">
      {!s.hidden && !s.suspended && <Button asChild variant="outline"><Link href={`/store/${s.slug}`}>ดูหน้าร้านที่ลูกค้าเห็น</Link></Button>}
      <Button asChild variant="ghost"><Link href="/merchant/settings">แก้ไขข้อมูลร้าน</Link></Button>
    </div>
  </>;
}
