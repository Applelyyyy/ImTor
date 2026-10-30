import Link from "next/link";
import { requireAdmin } from "@/components/auth-guard";
const links = [
  ["", "ภาพรวม"],
  ["users", "ผู้ใช้งาน"],
  ["stores", "ร้านค้า"],
  ["products", "สินค้า"],
  ["reports", "รายงานปัญหาสินค้า"],
  ["markets", "ตลาดและตาราง"],
  ["stalls", "โซนและล็อก"],
  ["attendance", "ร้านที่ออกขาย"],
  ["reservations", "การจอง"],
  ["analytics", "ผลลัพธ์และสถิติ"],
  ["demo-generator", "ข้อมูลสาธิต"],
  ["settings", "ตั้งค่าระบบ"],
  ["audit-logs", "บันทึกการจัดการ"],
];
export const metadata = { title: "จัดการระบบ" };
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="shell workspace">
      <aside className="sidebar">
        <h2>จัดการอิ่มต่อ</h2>
        <nav aria-label="เมนูผู้ดูแล">
          {links.map(([path, label]) => (
            <Link key={path} href={`/admin${path ? "/" + path : ""}`}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
