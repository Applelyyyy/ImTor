import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { money } from "@/lib/utils";
export default async function Analytics() {
  await requireAdmin();
  const [completed, rescue, regular] = await Promise.all([
    db.reservation.aggregate({
      where: { status: "COMPLETED", demoBatchId: null },
      _sum: { quantity: true },
    }),
    db.reservation.findMany({
      where: {
        status: "COMPLETED",
        demoBatchId: null,
        productMode: "RESCUE",
      },
      select: { quantity: true, unitPrice: true, originalPrice: true },
    }),
    db.product.count({
      where: {
        mode: "REGULAR",
        published: true,
        archived: false,
        demoBatchId: null,
      },
    }),
  ]);
  const rescued = rescue.reduce((sum, r) => sum + r.quantity, 0);
  const saved = rescue.reduce(
    (sum, r) => sum + (r.originalPrice - r.unitPrice) * r.quantity,
    0,
  );
  return (
    <>
      <PageHeading
        title="ทุกมื้อมีความหมาย"
        description="คำนวณจากการรับสินค้าสำเร็จจริง ไม่รวมข้อมูลสาธิต"
      />
      <div className="stats">
        {[
          ["จำนวนสินค้ารับแล้ว", completed._sum.quantity || 0],
          ["อาหาร RESCUE รับแล้ว", rescued],
          ["ส่วนต่างราคาที่ประหยัด", money(saved)],
          ["สินค้าราคาปกติที่เผยแพร่", regular],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="content-panel">
        <h2>นับอย่างตรงไปตรงมา</h2>
        <p>
          รายการขายปกติไม่นับเป็นอาหารช่วยลดเหลือ
          ข้อมูลนี้นับจำนวนชิ้นที่รับสำเร็จ
          ไม่ใช่น้ำหนักอาหารหรือการลดคาร์บอนที่ผ่านการรับรอง
        </p>
      </div>
    </>
  );
}
