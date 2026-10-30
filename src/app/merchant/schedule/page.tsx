import { merchantStore, NoStore } from "@/components/merchant";
import { markets } from "@/lib/queries";
import { PageHeading, date, time, EmptyState } from "@/components/marketplace";
import { AttendanceForm } from "@/components/attendance-form";
import { ApiButton, ApiForm } from "@/components/forms";
export default async function MerchantSchedule() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const venues = await markets();
  return (
    <>
      <PageHeading
        title="ตารางออกขาย"
        description="แจ้งตลาด ล็อก และยืนยันเมื่อร้านเปิดจริง"
      />
      <div className="stack">
        {!s.attendances.length ? (
          <EmptyState
            title="ยังไม่มีตารางขาย"
            description="เลือกวันและตลาดด้านล่างเพื่อเริ่มให้ลูกค้าหาคุณเจอ"
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันและตลาด</th>
                  <th>ล็อก</th>
                  <th>สถานะ</th>
                  <th>อัปเดต</th>
                </tr>
              </thead>
              <tbody>
                {s.attendances.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.session.market.name}</strong>
                      <div>
                        {date(a.session.startsAt.toISOString())}{" "}
                        {time(a.session.startsAt.toISOString())}
                      </div>
                    </td>
                    <td>
                      {a.assignment?.stall.code || "ไม่ระบุ"}
                      <div className="help-text">
                        {a.assignment?.verified
                          ? "ยืนยันตำแหน่งแล้ว"
                          : "ร้านแจ้งเอง"}
                      </div>
                    </td>
                    <td>
                      {a.status === "OPEN"
                        ? "ยืนยันเปิด"
                        : a.status === "CANCELLED"
                          ? "ยกเลิก"
                          : a.status === "CLOSED"
                            ? "ปิดแล้ว"
                            : "ตามตาราง"}
                    </td>
                    <td>
                      <div className="actions">
                        <ApiButton
                          endpoint={`/api/attendance/${a.id}`}
                          body={{ status: "OPEN", authorized: true }}
                        >
                          เปิดขายจริง
                        </ApiButton>
                        <ApiButton
                          endpoint={`/api/attendance/${a.id}`}
                          body={{ status: "CLOSED", authorized: true }}
                        >
                          ปิดร้าน
                        </ApiButton>
                        <ApiButton
                          endpoint={`/api/attendance/${a.id}`}
                          body={{ status: "CANCELLED", authorized: true }}
                          confirmMessage="ยกเลิกการเข้าร่วมตลาดครั้งนี้?"
                        >
                          ยกเลิก
                        </ApiButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="form-panel">
          <h2>เพิ่มวันออกขาย</h2>
          <AttendanceForm markets={venues} storeId={s.id} />
        </div>
        <details className="form-panel">
          <summary className="cursor-pointer font-semibold">
            บันทึกตำแหน่งประจำไว้ใช้ซ้ำ
          </summary>
          <div className="mt-6">
            <ApiForm
              endpoint="/api/templates"
              body={{ storeId: s.id }}
              fields={[
                {
                  name: "marketId",
                  label: "ตลาดประจำ",
                  type: "select",
                  required: true,
                  options: venues.map((m) => ({ value: m.id, label: m.name })),
                },
                {
                  name: "weekday",
                  label: "วันในสัปดาห์ (0 = อาทิตย์, 1 = จันทร์)",
                  type: "number",
                  required: true,
                  min: 0,
                  max: 6,
                },
                { name: "preferredCode", label: "รหัสล็อกที่ใช้ประจำ" },
              ]}
              submit="บันทึกตำแหน่งประจำ"
            />
          </div>
          {s.templates.map((t) => (
            <p className="help-text mt-4" key={t.id}>
              วัน {t.weekday} · {venues.find((m) => m.id === t.marketId)?.name}{" "}
              · {t.preferredCode}
            </p>
          ))}
        </details>
      </div>
    </>
  );
}
