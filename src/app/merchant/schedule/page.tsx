import Link from "next/link";
import { merchantStore, NoStore } from "@/components/merchant";
import { markets } from "@/lib/queries";
import { PageHeading, date, time, EmptyState } from "@/components/marketplace";
import { AttendanceForm } from "@/components/attendance-form";
import { ApiButton, ApiForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export default async function MerchantSchedule() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const venues = await markets();
  const now = new Date();
  const upcoming = s.attendances.filter((a) => a.session.endsAt > now && !["CANCELLED", "NOT_ATTENDING"].includes(a.status) && a.session.status !== "CANCELLED").sort((a, b) => a.session.startsAt.getTime() - b.session.startsAt.getTime());
  const past = s.attendances.filter((a) => !upcoming.some((next) => next.id === a.id)).sort((a, b) => b.session.startsAt.getTime() - a.session.startsAt.getTime());
  return <>
    <PageHeading title="วันขายและล็อก" description="เลือกตลาด วัน และตำแหน่งร้าน"><Button asChild variant="outline"><Link href="/merchant/settings">กลับตั้งค่าร้าน</Link></Button></PageHeading>
    <div className="stack">
      {!upcoming.length ? <EmptyState title="ยังไม่มีวันขายถัดไป" description="เลือกตลาดและวันด้านล่างเพื่อเริ่มให้ลูกค้าหาเจอ" /> : <section className="merchant-attendance-list" aria-label="วันออกขายที่ลงทะเบียน">
        {upcoming.map((a) => {
          const current = a.session.startsAt <= now && a.session.endsAt > now && a.session.status !== "CLOSED";
          return <article className="content-panel merchant-attendance-card" key={a.id}>
            <div><Badge variant={current && a.status === "OPEN" ? "default" : "secondary"}>{a.status === "CLOSED" ? "ปิดแล้ว" : current && a.status === "OPEN" ? "ร้านยืนยันเปิด" : current ? "ถึงรอบขายแล้ว" : "รอบถัดไป"}</Badge><h2>{a.session.market.name}</h2><p>{date(a.session.startsAt.toISOString())} {time(a.session.startsAt.toISOString())}–{time(a.session.endsAt.toISOString())}</p><p className="merchant-location">{a.assignment ? `ล็อก ${a.assignment.stall.code}` : "ยังไม่เลือกล็อก"}</p></div>
            <div className="merchant-attendance-actions">
              {current && !s.hidden && !s.suspended && <ApiButton endpoint={`/api/attendance/${a.id}`} body={{ status: a.status === "OPEN" ? "CLOSED" : "OPEN", authorized: true }}>{a.status === "OPEN" ? "ปิดร้านรอบนี้" : "เปิดร้านรอบนี้"}</ApiButton>}
              <Link href={`/markets/${a.session.market.slug}/map?${new URLSearchParams({ session: a.sessionId, ...(a.assignment ? { stall: a.assignment.stall.code } : {}) })}`} className="link-button">ดูตำแหน่ง</Link>
              <ApiButton endpoint={`/api/attendance/${a.id}`} body={{ status: "CANCELLED", authorized: true }} confirmMessage="ยกเลิกวันขายรอบนี้? ตำแหน่งร้านในรอบนี้จะไม่แสดงให้ลูกค้า">ยกเลิกวันขาย</ApiButton>
            </div>
          </article>;
        })}
      </section>}
      <section className="form-panel"><h2>เลือกวันหรือเปลี่ยนล็อก</h2><p className="help-text mb-5">เลือกรอบเดิมเพื่อเปลี่ยนล็อก รอบอื่นของร้านจะไม่เปลี่ยนตาม</p><AttendanceForm markets={venues} storeId={s.id} /></section>
      {!!past.length && <details className="merchant-optional content-panel"><summary>ประวัติวันขาย ({past.length})</summary><div className="mt-4 flex flex-col gap-3">{past.map((a) => <p key={a.id}>{date(a.session.startsAt.toISOString())} · {a.session.market.name} · {a.assignment?.stall.code ?? "ไม่ระบุล็อก"} · {a.status === "CANCELLED" ? "ยกเลิก" : a.status === "NOT_ATTENDING" ? "ไม่ได้เข้าร่วม" : "จบรอบแล้ว"}</p>)}</div></details>}
      <details className="merchant-optional form-panel"><summary>ตั้งวันขายประจำ (ไม่บังคับ)</summary><div className="mt-5"><ApiForm endpoint="/api/templates" body={{ storeId: s.id }} fields={[
        { name: "marketId", label: "ตลาด", type: "select", required: true, options: venues.map((m) => ({ value: m.id, label: m.name })) },
        { name: "weekday", label: "วันประจำ", type: "select", required: true, factor: 1, options: ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, value) => ({ value: String(value), label: `วัน${day}` })) },
        { name: "preferredCode", label: "ล็อกที่ใช้ประจำ", description: "เช่น A01" },
      ]} submit="บันทึกวันประจำ" /></div></details>
    </div>
  </>;
}
