import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { AdminTable } from "@/components/admin";
import { money } from "@/lib/utils";

export default async function Analytics() {
  await requireAdmin();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 35);
  const [groups, listings, history] = await Promise.all([
    db.reservation.groupBy({
      by: [
        "demoBatchId",
        "status",
        "productMode",
        "unitPrice",
        "originalPrice",
      ],
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    Promise.all(
      [false, true].map((demo) =>
        db.product.count({
          where: {
            mode: "REGULAR",
            published: true,
            archived: false,
            demoBatchId: demo ? { not: null } : null,
          },
        }),
      ),
    ),
    db.reservation.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        status: true,
        quantity: true,
        unitPrice: true,
        demoBatchId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const totals = [false, true].map((demo, index) => {
    const completed = groups.filter(
      (r) => !!r.demoBatchId === demo && r.status === "COMPLETED",
    );
    const rescue = completed.filter((r) => r.productMode === "RESCUE");
    return {
      demo,
      values: [
        [
          "จำนวนสินค้ารับแล้ว",
          completed.reduce((n, r) => n + (r._sum.quantity ?? 0), 0),
        ],
        [
          "อาหาร RESCUE รับแล้ว",
          rescue.reduce((n, r) => n + (r._sum.quantity ?? 0), 0),
        ],
        [
          "มูลค่ารับสินค้าสำเร็จ",
          money(
            completed.reduce(
              (n, r) => n + r.unitPrice * (r._sum.quantity ?? 0),
              0,
            ),
          ),
        ],
        [
          "ส่วนต่างราคา RESCUE",
          money(
            rescue.reduce(
              (n, r) =>
                n + (r.originalPrice - r.unitPrice) * (r._sum.quantity ?? 0),
              0,
            ),
          ),
        ],
        ["สินค้าราคาปกติที่เผยแพร่", listings[index]],
        [
          "การจองทั้งหมด",
          groups
            .filter((r) => !!r.demoBatchId === demo)
            .reduce((n, r) => n + r._count._all, 0),
        ],
      ] as const,
    };
  });
  const daily = new Map<
    string,
    {
      date: string;
      demo: boolean;
      count: number;
      completed: number;
      reserved: number;
      cancelled: number;
      expired: number;
      amount: number;
    }
  >();
  for (const r of history) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
    }).format(r.createdAt);
    const key = `${date}:${!!r.demoBatchId}`;
    const row = daily.get(key) ?? {
      date,
      demo: !!r.demoBatchId,
      count: 0,
      completed: 0,
      reserved: 0,
      cancelled: 0,
      expired: 0,
      amount: 0,
    };
    row.count++;
    if (r.status === "COMPLETED") {
      row.completed++;
      row.amount += r.quantity * r.unitPrice;
    }
    if (r.status === "RESERVED") row.reserved++;
    if (r.status === "CANCELLED") row.cancelled++;
    if (r.status === "EXPIRED") row.expired++;
    daily.set(key, row);
  }
  const days = [...daily.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || Number(a.demo) - Number(b.demo),
  );
  return (
    <>
      <PageHeading
        title="ทุกมื้อมีความหมาย"
        description="คำนวณจากรายการจองที่บันทึกจริง แยกกิจกรรมจริงออกจากข้อมูลจำลองอย่างชัดเจน"
      />
      {totals.map(({ demo, values }) => (
        <section key={String(demo)} className="mb-8">
          <h2 className="mb-4 text-xl">
            {demo
              ? "สถิติสาธิต · ไม่ใช่ยอดขายหรือผลกระทบจริง"
              : "สถิติจริง · ไม่รวมข้อมูลสาธิต"}
          </h2>
          <div className="stats">
            {values.map(([label, value]) => (
              <div className="stat" key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
      <AdminTable
        title="ประวัติการจอง 35 วันที่ผ่านมา"
        description="แบ่งวันตามเวลาสร้างการจองในกรุงเทพฯ และแสดงสถานะปัจจุบัน ไม่สร้างจำนวนผู้เข้าชมหรือกิจกรรมสมมติ"
        headers={[
          "วันสร้างรายการ",
          "ข้อมูล",
          "การจอง",
          "รอรับ",
          "รับแล้ว",
          "ยกเลิก",
          "หมดอายุ",
          "มูลค่ารับสำเร็จ",
        ]}
        searchValues={days.map((r) => `${r.date} ${r.demo ? "สาธิต" : "จริง"}`)}
        rows={days.map((r) => [
          r.date,
          r.demo ? "สาธิต" : "จริง",
          r.count,
          r.reserved,
          r.completed,
          r.cancelled,
          r.expired,
          money(r.amount),
        ])}
      />
    </>
  );
}
