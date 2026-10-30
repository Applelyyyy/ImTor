import Link from "next/link";
import { notFound } from "next/navigation";
import { market, products } from "@/lib/queries";
import {
  PageHeading,
  ProductGrid,
  date,
  time,
  statusLabel,
} from "@/components/marketplace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export default async function MarketDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = await market(slug);
  if (!m) notFound();
  const items = await products({ market: slug });
  return (
    <div className="shell page">
      <div className="breadcrumbs">
        <Link href="/markets">ตลาดทั้งหมด</Link>
        <span>/</span>
        {m.name}
      </div>
      <PageHeading title={m.name} description={m.description}>
        <Button asChild>
          <Link href={`/markets/${slug}/map`}>ดูแผนผังตลาด</Link>
        </Button>
      </PageHeading>
      {m.demo && (
        <Badge variant="outline">ตลาดตัวอย่าง ไม่ใช่สถานที่จริง</Badge>
      )}
      <div className="two-col mb-10">
        <div className="content-panel">
          <h2>แวะมาหากัน</h2>
          <p>{m.address}</p>
          <p>{m.entrance}</p>
          {m.latitude !== null && m.longitude !== null && (
            <Button asChild variant="outline" className="mt-5">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                นำทางไปทางเข้าตลาด
              </a>
            </Button>
          )}
          <p className="help-text mt-4">
            เส้นทางภายในตลาด ดูตำแหน่งล็อกในแผนผังอิ่มต่อ
          </p>
        </div>
        <div className="content-panel">
          <h2>นัดหมายครั้งถัดไป</h2>
          {m.sessions.slice(0, 3).map((s) => (
            <div className="session-row" key={s.id}>
              <div>
                <strong>
                  {date(s.startsAt)} · {time(s.startsAt)}–{time(s.endsAt)}
                </strong>
                <small>
                  {s.vendorCount} ร้านลงทะเบียน · {s.confirmedCount}{" "}
                  ร้านยืนยันเปิด
                </small>
              </div>
              <Badge variant="secondary">
                {statusLabel[s.status] || s.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>ของอร่อยที่ตลาดนี้</h2>
          <p>เฉพาะสินค้าของร้านที่ลงทะเบียนขายในช่วงนี้</p>
        </div>
      </div>
      <ProductGrid items={items} />
    </div>
  );
}
