import { notFound } from "next/navigation";
import { merchantStore, NoStore, productFields } from "@/components/merchant";
import { categories } from "@/lib/queries";
import { ApiForm } from "@/components/forms";
import { PageHeading, date, time } from "@/components/marketplace";
import { money } from "@/lib/utils";
export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const { id } = await params;
  const p = s.products.find((p) => p.id === id);
  if (!p) notFound();
  const cats = await categories();
  return (
    <>
      <PageHeading
        title={`แก้ไข ${p.name}`}
        description="ราคาจะแสดงตามกฎที่มีผลจริงเท่านั้น"
      />
      <div className="stack">
        <div className="form-panel">
          <ApiForm
            endpoint={`/api/products/${id}`}
            method="PATCH"
            fields={productFields(cats, p)}
            advancedFrom={3}
            submit="บันทึกสินค้า"
          />
        </div>
        <div className="form-panel">
          <h2>ตั้งช่วงลดราคา</h2>
          {p.discounts.map((d) => (
            <p key={d.id} className="help-text mb-4">
              {d.kind === "FIXED" ? money(d.value) : `${d.value}%`} ·{" "}
              {date(d.startsAt.toISOString())} {time(d.startsAt.toISOString())}{" "}
              – {date(d.endsAt.toISOString())} {time(d.endsAt.toISOString())}
            </p>
          ))}
          <ApiForm
            endpoint={`/api/products/${id}/discounts`}
            fields={[
              {
                name: "kind",
                label: "รูปแบบส่วนลด",
                type: "select",
                required: true,
                value: "PERCENT_OFF",
                options: [
                  { value: "PERCENT_OFF", label: "ลดจากราคาเดิม (%)" },
                  {
                    value: "FINAL_PERCENT",
                    label: "ขายในสัดส่วนของราคาเดิม (%)",
                  },
                  { value: "FIXED", label: "กำหนดราคาสุดท้าย (สตางค์)" },
                ],
              },
              {
                name: "value",
                label: "ค่าส่วนลด (เปอร์เซ็นต์ หรือราคาสุดท้ายหน่วยสตางค์)",
                type: "number",
                required: true,
                min: 0,
              },
              {
                name: "startsAt",
                label: "เริ่มลดราคา",
                type: "datetime-local",
                required: true,
              },
              {
                name: "endsAt",
                label: "สิ้นสุดลดราคา",
                type: "datetime-local",
                required: true,
              },
              {
                name: "repeatStart",
                label: "ลดซ้ำทุกวันตั้งแต่ (ไม่บังคับ)",
                type: "time",
              },
              { name: "repeatEnd", label: "ลดซ้ำทุกวันถึง", type: "time" },
              {
                name: "priority",
                label: "ลำดับความสำคัญ (ค่าสูงใช้ก่อน)",
                type: "number",
                value: 0,
                min: 0,
              },
            ]}
            submit="เพิ่มช่วงลดราคา"
          />
        </div>
      </div>
    </>
  );
}
