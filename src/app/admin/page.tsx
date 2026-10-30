import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
export default async function AdminDashboard() {
  await requireAdmin();
  const [users, stores, products, markets, reservations, reports] =
    await Promise.all([
      db.user.count(),
      db.store.count(),
      db.product.count({ where: { archived: false } }),
      db.marketVenue.count(),
      db.reservation.count({ where: { status: "RESERVED" } }),
      db.report.count({ where: { status: "OPEN" } }),
    ]);
  return (
    <>
      <PageHeading
        title="ภาพรวมชุมชนอิ่มต่อ"
        description="ดูแลร้าน ตลาด และทุกมื้อดี ๆ ของชุมชน"
      />
      <div className="stats">
        {[
          ["ผู้ใช้งาน", users],
          ["ร้านค้า", stores],
          ["สินค้า", products],
          ["ตลาด", markets],
          ["การจองรอรับ", reservations],
          ["รายงานรอตรวจสอบ", reports],
        ].map(([label, count]) => (
          <div className="stat" key={label}>
            <p>{label}</p>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div className="two-col">
        <section className="content-panel">
          <h2>ดูแลนัดอร่อย</h2>
          <p>สร้างตลาด กำหนดวันเวลา และเพิ่มโซนกับตำแหน่งล็อก</p>
          <Button asChild className="mt-5">
            <Link href="/admin/markets">จัดการตลาด</Link>
          </Button>
        </section>
        <section className="content-panel">
          <h2>พร้อมสำหรับการสาธิต</h2>
          <p>สร้างข้อมูลจำลองแยกชุด ล้างเฉพาะชุดที่สร้าง ไม่กระทบข้อมูลจริง</p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/admin/demo-generator">จัดการข้อมูลสาธิต</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
