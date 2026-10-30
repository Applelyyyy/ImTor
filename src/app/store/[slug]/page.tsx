import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { store, products } from "@/lib/queries";
import { PageHeading, ProductGrid, date, time } from "@/components/marketplace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await store(slug);
  if (!s) notFound();
  const items = await products({ storeId: s.id });
  const now = new Date();
  const attendance = s.attendances.filter(
    (a) => a.session.endsAt > now && !["CANCELLED", "CLOSED", "NOT_ATTENDING"].includes(a.status) && !["CANCELLED", "CLOSED"].includes(a.session.status),
  );
  return (
    <div className="shell page">
      {s.imageUrl && <div className="relative mb-6 h-56 overflow-hidden rounded-2xl md:h-80">
        <Image src={s.imageUrl} alt={`ภาพร้าน ${s.name}${s.demoBatchId ? " (ภาพสาธิต)" : ""}`} fill sizes="(max-width: 780px) 100vw, 1200px" className="object-cover" priority />
      </div>}
      <PageHeading title={s.name} description={s.description}>
        <Badge
          variant={s.open && s.kind !== "MARKET" ? "default" : "secondary"}
        >
          {s.open && s.kind !== "MARKET"
            ? "ร้านยืนยันเปิด"
            : "ดูตารางขายของร้าน"}
        </Badge>
      </PageHeading>
      {s.demoBatchId && (
        <Badge variant="outline">ร้านค้าตัวอย่าง ไม่ใช่ร้านจริง</Badge>
      )}
      <div className="two-col mb-10">
        <section className="content-panel">
          <h2>ร้านนี้อยู่ที่ไหน?</h2>
          <p>{s.address || "ร้านค้าในตลาด ดูวันและตำแหน่งขายด้านข้าง"}</p>
          {!s.demoBatchId && s.latitude !== null && s.longitude !== null && (
            <Button asChild variant="outline" className="mt-5">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`}
              >
                นำทางไปหน้าร้าน
              </a>
            </Button>
          )}
          <p className="help-text mt-4">
            {s.verified ? "ร้านยืนยันแล้ว" : "ร้านลงทะเบียนด้วยตนเอง"}
          </p>
        </section>
        <section className="content-panel">
          <h2>เจอกันที่ตลาด</h2>
          {attendance.length ? (
            attendance.slice(0, 4).map((a) => (
              <div className="session-row" key={a.id}>
                <div>
                  <strong>
                    {a.session.market.name} ·{" "}
                    {date(a.session.startsAt.toISOString())}
                  </strong>
                  <small>
                    {a.status === "OPEN" && a.session.startsAt <= now ? "ร้านยืนยันเปิด · " : "ตามตาราง ยังไม่ยืนยันเปิด · "}
                    {time(a.session.startsAt.toISOString())}–
                    {time(a.session.endsAt.toISOString())} ·{" "}
                    {a.assignment
                      ? `โซน ${a.assignment.stall.zone.name} ล็อก ${a.assignment.stall.code}`
                      : "ยังไม่ระบุล็อก"}{" "}
                    · {a.assignment?.verified ? "ยืนยันตำแหน่ง" : "ร้านแจ้งเอง"}
                  </small>
                </div>
                <Link
                  className="link-button"
                  href={`/markets/${a.session.market.slug}/map?${new URLSearchParams({ session: a.sessionId, ...(a.assignment ? { stall: a.assignment.stall.code } : {}) })}`}
                >
                  ดูแผนผัง
                </Link>
              </div>
            ))
          ) : (
            <p>ยังไม่ได้ลงทะเบียนตลาดครั้งถัดไป</p>
          )}
        </section>
      </div>
      <div className="section-heading">
        <h2>เมนูและสินค้าของร้าน</h2>
        <span className="help-text">{items.length} รายการ</span>
      </div>
      <ProductGrid items={items} />
    </div>
  );
}
