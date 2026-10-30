import Link from "next/link";
import { merchantStore, NoStore } from "@/components/merchant";
import { PageHeading } from "@/components/marketplace";
import { ApiButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
export default async function MerchantDashboard() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const count = await db.reservation.count({
    where: { product: { storeId: s.id }, status: "RESERVED" },
  });
  return (
    <>
      <PageHeading
        title={`สวัสดี ${s.name}`}
        description="พร้อมส่งต่อมื้อดี ๆ ให้คนในแคมปัสแล้วหรือยัง?"
      >
        <Button asChild>
          <Link href="/merchant/products/new">+ เพิ่มสินค้า</Link>
        </Button>
      </PageHeading>
      {s.suspended && (
        <p className="form-error mb-5">
          ร้านถูกระงับการแสดงผล กรุณาติดต่อผู้ดูแล
        </p>
      )}
      <div className="stats">
        <div className="stat">
          <p>สินค้าเผยแพร่</p>
          <strong>
            {s.products.filter((p) => p.published && !p.archived).length}
          </strong>
        </div>
        <div className="stat">
          <p>การจองรอรับ</p>
          <strong>{count}</strong>
        </div>
        <div className="stat">
          <p>ตลาดที่ลงทะเบียน</p>
          <strong>
            {
              s.attendances.filter(
                (a) =>
                  a.status !== "CANCELLED" && a.session.endsAt > new Date(),
              ).length
            }
          </strong>
        </div>
      </div>
      <div className="content-panel stack">
        <h2>สถานะหน้าร้าน</h2>
        <p>ร้านประจำและร้านตลาดมีสถานะแยกกัน เพื่อให้ลูกค้าไม่เดินมาเก้อ</p>
        {s.kind !== "MARKET" && (
          <div className="status-inline">
            <strong>{s.open ? "ร้านประจำเปิดอยู่" : "ร้านประจำปิดอยู่"}</strong>
            <ApiButton
              endpoint={`/api/stores/${s.id}`}
              body={{ open: !s.open }}
            >
              {s.open ? "ปิดร้านประจำ" : "ยืนยันเปิดร้านประจำ"}
            </ApiButton>
          </div>
        )}
        <Button asChild variant="outline">
          <Link href="/merchant/schedule">
            ยืนยันเปิดร้านในตลาด / เลือกตารางขาย
          </Link>
        </Button>
        <Link className="link-button" href={`/store/${s.slug}`}>
          ดูหน้าร้านของฉัน →
        </Link>
      </div>
      <div className="two-col mt-6">
        <section className="content-panel">
          <h2>เพิ่มสินค้าให้ร้าน</h2>
          <p>
            ขายเต็มราคาได้ตามปกติ ตั้งส่วนลดเมื่อต้องการ
            หรือส่งต่ออาหารที่ยังดีในราคาคุ้มค่า
          </p>
          <Button asChild className="mt-5">
            <Link href="/merchant/products/new">เพิ่มสินค้าใหม่</Link>
          </Button>
        </section>
        <section className="content-panel">
          <h2>วันนี้ขายที่ไหน?</h2>
          <p>แจ้งตลาด ล็อก และเวลาที่จะขาย เพื่อให้ลูกค้าหาร้านเจอง่ายขึ้น</p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/merchant/locations">เลือกตำแหน่งร้าน</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
