import { requireAdmin } from "@/components/auth-guard";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { ApiForm } from "@/components/forms";
import { LayoutEditor } from "@/components/layout-editor";
export default async function LayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const m = await db.marketVenue.findUnique({
    where: { id },
    include: {
      zones: { orderBy: { name: "asc" } },
      stalls: { orderBy: { code: "asc" } },
    },
  });
  if (!m) notFound();
  return (
    <>
      <PageHeading
        title={`ผังและล็อก ${m.name}`}
        description="อัปโหลดผัง เพิ่มโซน แล้ววางตำแหน่งล็อก ไม่ใช้แผนที่แบบเสียเงิน"
      />
      <div className="stack">
        <div className="two-col">
          <div className="form-panel">
            <h2>ภาพผังตลาด</h2>
            <ApiForm
              endpoint={`/api/admin/markets/${id}`}
              method="PATCH"
              fields={[
                {
                  name: "layoutImage",
                  label: "อัปโหลดภาพผัง",
                  type: "upload",
                  value: m.layoutImage,
                },
              ]}
              submit="บันทึกภาพผัง"
            />
          </div>
          <div className="form-panel">
            <h2>เพิ่มโซน</h2>
            <p className="help-text mb-4">
              โซนปัจจุบัน: {m.zones.map((z) => z.name).join(", ") || "ยังไม่มี"}
            </p>
            <ApiForm
              endpoint={`/api/admin/markets/${id}/zones`}
              fields={[
                {
                  name: "name",
                  label: "ชื่อโซน เช่น A หรือ B",
                  required: true,
                },
              ]}
              submit="เพิ่มโซน"
            />
          </div>
        </div>
        <LayoutEditor
          marketId={id}
          image={m.layoutImage}
          zones={m.zones}
          stalls={m.stalls}
        />
      </div>
    </>
  );
}
