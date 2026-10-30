import { AdminDeleteButton } from "@/components/admin-delete-button";
import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
import { date, time } from "@/components/marketplace";
export const metadata = { title: "รายงานปัญหาสินค้า" };
const labels: Record<string, string> = {
  OPEN: "รอตรวจสอบ",
  RESOLVED: "แก้ไขแล้ว",
  DISMISSED: "ปิดรายงาน",
};
export default async function Reports() {
  await requireAdmin();
  const reports = await db.report.findMany({
    take: 150,
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, store: { select: { name: true } } },
      },
    },
  });
  return (
    <AdminTable
      title="รายงานปัญหาสินค้า"
      description="150 รายงานล่าสุด ตรวจสอบรายละเอียดก่อนแก้ไขสินค้าหรือปิดรายงาน"
      headers={["สินค้า / ร้าน", "รายละเอียดปัญหา", "เวลา", "สถานะ", "จัดการ"]}
      rows={reports.map((r) => [
        <div key="product">
          <Link className="link-button" href={`/product/${r.productId}`}>
            {r.product.name}
          </Link>
          <small className="block">{r.product.store.name}</small>
        </div>,
        <p className="whitespace-pre-wrap break-words" key="reason">
          {r.reason}
        </p>,
        `${date(r.createdAt.toISOString())} ${time(r.createdAt.toISOString())}`,
        labels[r.status] || r.status,
        <div key="actions" className="actions">
          {r.status !== "RESOLVED" && (
            <ApiButton
              endpoint={`/api/admin/reports/${r.id}`}
              body={{ status: "RESOLVED" }}
            >
              แก้ไขแล้ว
            </ApiButton>
          )}
          {r.status !== "DISMISSED" && (
            <ApiButton
              endpoint={`/api/admin/reports/${r.id}`}
              body={{ status: "DISMISSED" }}
            >
              ปิดรายงาน
            </ApiButton>
          )}
          {r.status !== "OPEN" && (
            <ApiButton
              endpoint={`/api/admin/reports/${r.id}`}
              body={{ status: "OPEN" }}
            >
              ตรวจสอบอีกครั้ง
            </ApiButton>
          )}
          <AdminDeleteButton endpoint={`/api/admin/reports/${r.id}`} name={`รายงานนี้`} related />
        </div>,
      ])}
    />
  );
}
