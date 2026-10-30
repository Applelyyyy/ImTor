import { AdminTableControls } from "@/components/admin-table-controls";
import { PageHeading, EmptyState } from "@/components/marketplace";
export function AdminTable({
  title,
  description,
  headers,
  rows,
  searchValues,
  total = rows.length,
}: {
  title: string;
  description?: string;
  headers: string[];
  rows: React.ReactNode[][];
  searchValues?: string[];
  total?: number;
}) {
  return (
    <>
      <PageHeading title={title} description={description} />
      {!rows.length ? (
        <EmptyState
          title="ยังไม่มีข้อมูล"
          description="รายการที่เพิ่มเข้าระบบจะแสดงที่นี่"
        />
      ) : (
        <AdminTableControls headers={headers} rows={rows} total={total}
          searchValues={searchValues ?? rows.map((row) => row.filter((cell) => typeof cell === "string" || typeof cell === "number").join(" "))} />
      )}
    </>
  );
}
export const marketFields = [
  { name: "name", label: "ชื่อตลาด", required: true },
  { name: "type", label: "ประเภทตลาด", value: "ตลาดนัด", required: true },
  { name: "description", label: "รายละเอียด", type: "textarea" as const },
  { name: "address", label: "ที่อยู่" },
  { name: "entrance", label: "คำแนะนำทางเข้า" },
  {
    name: "latitude",
    label: "ละติจูด (เฉพาะพิกัดจริงที่ตรวจสอบแล้ว)",
    type: "number" as const,
    min: -90,
    max: 90,
    step: "any",
  },
  {
    name: "longitude",
    label: "ลองจิจูด",
    type: "number" as const,
    min: -180,
    max: 180,
    step: "any",
  },
  { name: "timezone", label: "เขตเวลา", value: "Asia/Bangkok", required: true },
];
