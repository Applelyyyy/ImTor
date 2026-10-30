import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { PageHeading, date, time } from "@/components/marketplace";
import { ApiForm } from "@/components/forms";
import { DEMO_SCENARIOS } from "@/services/demo";
import { AdminDeleteButton } from "@/components/admin-delete-button";
const scenarios: Record<string, string> = {
  campus: "ชุมชนแคมปัสครบชุด",
  "small-market": "ตลาดเล็ก",
  "large-market": "ตลาดใหญ่",
  "many-vendors": "ร้านค้าจำนวนมาก",
  "few-vendors": "ร้านค้าจำนวนน้อย",
  "moving-vendor": "ร้านเปลี่ยนตลาด",
  "closed-merchant": "ร้านปิด",
  regular: "ขายราคาปกติ",
  "active-discounts": "ส่วนลดกำลังทำงาน",
  "upcoming-discounts": "ส่วนลดที่กำลังจะมา",
  rescue: "อาหารช่วยลดเหลือ",
  "low-stock": "สินค้าใกล้หมด",
  pickup: "การรับสินค้า",
};
export default async function DemoGenerator() {
  await requireAdmin();
  const batches = await db.demoBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return (
    <>
      <PageHeading
        title="ชุดข้อมูล"
        description=""
      />
      <div className="stack">
        <div className="form-panel">
          <h2>สร้างชุดข้อมูลใหม่</h2>
          {process.env.ENABLE_DEMO_GENERATOR === "true" ? (
            <ApiForm
              endpoint="/api/admin/demo"
              fields={[
                {
                  name: "scenario",
                  label: "สถานการณ์",
                  type: "select",
                  required: true,
                  value: "campus",
                  options: DEMO_SCENARIOS.map((value) => ({
                    value,
                    label: scenarios[value] || value,
                  })),
                },
                {
                  name: "stores",
                  label: "จำนวนร้านค้า",
                  type: "number",
                  value: 20,
                  min: 1,
                  max: 100,
                },
                {
                  name: "products",
                  label: "จำนวนสินค้า",
                  type: "number",
                  value: 100,
                  min: 1,
                  max: 1000,
                },
                {
                  name: "customers",
                  label: "จำนวนลูกค้า",
                  type: "number",
                  value: 30,
                  min: 1,
                  max: 300,
                },
                {
                  name: "stalls",
                  label: "จำนวนล็อก",
                  type: "number",
                  value: 80,
                  min: 2,
                  max: 500,
                },
              ]}
              submit="สร้างชุดชุดข้อมูล"
            />
          ) : (
            <p className="help-text">
              ยังไม่เปิดตัวสร้างข้อมูล ตั้งค่า ENABLE_DEMO_GENERATOR=true
              ในสภาพแวดล้อมที่เปิดใช้งานก่อนใช้งาน
            </p>
          )}
        </div>
        <div className="content-panel">
          <h2>ชุดข้อมูลที่สร้างไว้</h2>
          {!batches.length && <p>ยังไม่มีชุดชุดข้อมูล</p>}
          {batches.map((b) => (
            <div className="session-row" key={b.id}>
              <div>
                <strong>{b.label}</strong>
                <small>
                  {date(b.createdAt.toISOString())}{" "}
                  {time(b.createdAt.toISOString())} · {b.id}
                </small>
              </div>
              <AdminDeleteButton endpoint={`/api/admin/demo/${b.id}`} name={`ชุดข้อมูล ${b.label}`} related />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
