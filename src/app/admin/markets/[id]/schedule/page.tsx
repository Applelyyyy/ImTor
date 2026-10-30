import { requireAdmin } from "@/components/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeading, date, time, statusLabel } from "@/components/marketplace";
import { marketFields } from "@/components/admin";
import { ApiForm, ApiButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { MarketScheduleService } from "@/services/schedule";
export default async function Schedule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  await MarketScheduleService.ensureSessions();
  const m = await db.marketVenue.findUnique({
    where: { id },
    include: {
      rules: { orderBy: { weekday: "asc" } },
      exceptions: true,
      sessions: {
        where: { endsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 14,
      },
    },
  });
  if (!m) notFound();
  return (
    <>
      <PageHeading
        title={`ตาราง ${m.name}`}
        description="วันและเวลาคำนวณตามเขตเวลาของตลาด"
      >
        <Button asChild variant="outline">
          <Link href={`/admin/markets/${id}/layout`}>จัดการผังตลาด</Link>
        </Button>
      </PageHeading>
      <div className="stack">
        <div className="content-panel">
          <h2>ปฏิทินตัวอย่างจากตารางที่บันทึก</h2>
          {m.sessions.map((s) => (
            <div className="session-row" key={s.id}>
              <div>
                <strong>{date(s.startsAt.toISOString())}</strong>
                <small>
                  {time(s.startsAt.toISOString())}–
                  {time(s.endsAt.toISOString())} ·{" "}
                  {statusLabel[MarketScheduleService.status(s)]}
                </small>
              </div>
              <ApiButton
                endpoint={`/api/admin/sessions/${s.id}`}
                body={{
                  status: s.status === "CANCELLED" ? "SCHEDULED" : "CANCELLED",
                }}
                confirmMessage="การยกเลิกรอบตลาดจะยกเลิกการเข้าร่วมและการจองที่เกี่ยวข้อง ยืนยัน?"
              >
                {s.status === "CANCELLED" ? "เปิดรอบอีกครั้ง" : "ยกเลิกรอบ"}
              </ApiButton>
            </div>
          ))}
        </div>
        <div className="form-panel">
          <h2>กฎวันเปิดประจำ</h2>
          <p className="help-text mb-5">
            การเปลี่ยนตารางที่มีร้านลงทะเบียนแล้วต้องจัดการรอบที่ได้รับผลกระทบก่อน
            ระบบจะไม่เปลี่ยนเวลาโดยเงียบ ๆ
          </p>
          {m.rules.map((r) => (
            <div key={r.id} className="session-row">
              <div>
                วัน{" "}
                {
                  [
                    "อาทิตย์",
                    "จันทร์",
                    "อังคาร",
                    "พุธ",
                    "พฤหัส",
                    "ศุกร์",
                    "เสาร์",
                  ][r.weekday]
                }{" "}
                {r.opens}–{r.closes}
                <small className="block">
                  ทุก {r.intervalWeeks} สัปดาห์ · อ้างอิง {r.anchorDate}
                </small>
              </div>
              <ApiButton
                endpoint={`/api/admin/rules/${r.id}`}
                method="DELETE"
                confirmMessage="ลบกฎวันเปิดนี้?"
              >
                ลบกฎ
              </ApiButton>
            </div>
          ))}
          <ApiForm
            endpoint={`/api/admin/markets/${id}/rules`}
            fields={[
              {
                name: "weekday",
                label: "วันเปิด",
                type: "select",
                required: true,
                options: [
                  "อาทิตย์",
                  "จันทร์",
                  "อังคาร",
                  "พุธ",
                  "พฤหัสบดี",
                  "ศุกร์",
                  "เสาร์",
                ].map((label, value) => ({ label, value: String(value) })),
                value: "1",
                factor: 1,
              },
              {
                name: "opens",
                label: "เวลาเปิด",
                type: "time",
                required: true,
              },
              {
                name: "closes",
                label: "เวลาปิด (ข้ามเที่ยงคืนได้)",
                type: "time",
                required: true,
              },
              {
                name: "intervalWeeks",
                label: "เปิดทุกกี่สัปดาห์",
                type: "number",
                value: 1,
                min: 1,
                max: 2,
                required: true,
              },
              {
                name: "anchorDate",
                label: "วันจันทร์เริ่มสัปดาห์อ้างอิง",
                type: "date",
                required: true,
                value: "2026-01-05",
              },
            ]}
            submit="บันทึกกฎวันเปิด"
          />
        </div>
        <div className="form-panel">
          <h2>วันหยุดและนัดพิเศษ</h2>
          {m.exceptions.map((e) => (
            <p className="help-text mb-3" key={e.id}>
              {e.date} · {e.cancelled ? "หยุดตลาด" : `${e.opens}–${e.closes}`} ·{" "}
              {e.reason}
            </p>
          ))}
          <ApiForm
            endpoint={`/api/admin/markets/${id}/exceptions`}
            fields={[
              { name: "date", label: "วันที่", type: "date", required: true },
              { name: "cancelled", label: "ปิดตลาดในวันนี้", type: "checkbox" },
              {
                name: "opens",
                label: "เวลาเปิดพิเศษ (เมื่อไม่ปิดตลาด)",
                type: "time",
              },
              { name: "closes", label: "เวลาปิดพิเศษ", type: "time" },
              { name: "reason", label: "เหตุผลหรือชื่องานพิเศษ" },
            ]}
            submit="บันทึกวันพิเศษ"
          />
        </div>
        <details className="form-panel">
          <summary className="font-semibold cursor-pointer">
            แก้ไขข้อมูลตลาดและพิกัด
          </summary>
          <div className="mt-6">
            <ApiForm
              endpoint={`/api/admin/markets/${id}`}
              method="PATCH"
              fields={marketFields.map((f) => ({
                ...f,
                value: m[f.name as keyof typeof m] as string | number | null,
              }))}
              submit="บันทึกข้อมูลตลาด"
            />
          </div>
        </details>
      </div>
    </>
  );
}
