import Link from "next/link";
import { requireAdmin } from "@/components/auth-guard";
import { PageHeading } from "@/components/marketplace";
import { ApiForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
export default async function NewMarketPage() {
  await requireAdmin();
  return (
    <div className="stack">
      <PageHeading
        title="เพิ่มตลาด"
        description="เริ่มจากชื่อและประเภท ส่วนผังและวันเปิดเพิ่มภายหลังได้"
      >
        <Button asChild variant="outline">
          <Link href="/admin/markets">กลับรายการตลาด</Link>
        </Button>
      </PageHeading>
      <section className="form-panel">
        <ApiForm
          endpoint="/api/admin/markets"
          redirect="/admin/markets"
          advancedFrom={3}
          fields={[
            { name: "name", label: "ชื่อตลาด", required: true },
            {
              name: "type",
              label: "ประเภท",
              type: "select",
              required: true,
              value: "SMALL",
              options: [
                { value: "SMALL", label: "ตลาดเล็ก" },
                { value: "LARGE", label: "ตลาดใหญ่" },
                { value: "OTHER", label: "ตลาดประเภทอื่น" },
              ],
            },
            { name: "address", label: "ที่อยู่ (ไม่บังคับ)" },
            { name: "description", label: "รายละเอียด", type: "textarea" },
            { name: "entrance", label: "ทางเข้า / จุดสังเกต" },
            {
              name: "timezone",
              label: "เขตเวลา",
              value: "Asia/Bangkok",
              required: true,
            },
          ]}
          submit="สร้างตลาด"
        />
      </section>
    </div>
  );
}
