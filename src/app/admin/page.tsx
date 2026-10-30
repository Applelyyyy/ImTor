import { requireAdmin } from "@/components/auth-guard";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
export default async function AdminDashboard() {
  await requireAdmin();
  const metrics = await Promise.all([false, true].map(async (demo) => {
    const demoBatchId = demo ? { not: null } : null;
    const [users, stores, products, markets, reservations, reports] = await Promise.all([
      db.user.count({ where: { demoBatchId } }),
      db.store.count({ where: { demoBatchId } }),
      db.product.count({ where: { archived: false, demoBatchId } }),
      db.marketVenue.count({ where: { demoBatchId } }),
      db.reservation.count({ where: { status: "RESERVED", demoBatchId } }),
      db.report.count({ where: { status: "OPEN", product: { demoBatchId } } }),
    ]);
    return { demo, values: [["ผู้ใช้งาน", users], ["ร้านค้า", stores], ["สินค้า", products], ["ตลาด", markets], ["การจองรอรับ", reservations], ["รายงานรอตรวจสอบ", reports]] as const };
  }));
  return (
    <>
      <PageHeading
        title="ภาพรวมชุมชนอิ่มต่อ"
        description="ดูแลร้าน ตลาด และทุกมื้อดี ๆ ของชุมชน"
      />
      {metrics.map(({ demo, values }) => <section key={String(demo)} className="mb-8">
        <h2 className="mb-4 text-xl">{demo ? "ชุมชนจำลอง · ไม่ใช่กิจกรรมจริง" : "ข้อมูลจริง · ไม่รวมชุดสาธิต"}</h2>
        <div className="stats">{values.map(([label, count]) => <div className="stat" key={label}><p>{label}</p><strong>{count}</strong></div>)}</div>
      </section>)}
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
