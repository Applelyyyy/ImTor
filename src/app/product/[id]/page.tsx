import { pickupWindow } from "@/lib/pickup-window";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { product, publicFeatures } from "@/lib/queries";
import { money } from "@/lib/utils";
import { date, time } from "@/components/marketplace";
import { ContextualForm } from "@/components/contextual-form";
import { ReportForm } from "@/components/report-form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await product(id);
  return { title: p?.name || "สินค้า" };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, features] = await Promise.all([product(id), publicFeatures()]);
  if (!p) notFound();
  return (
    <div className="shell page">
      <div className="breadcrumbs">
        <Link href="/">ค้นพบของอร่อย</Link> /{" "}
        <Link href={`/store/${p.store.slug}`}>{p.store.name}</Link> / {p.name}
      </div>
      <div className="two-col product-detail">
        <div className="detail-photo">
          <Image
            src={p.imageUrl}
            alt={p.name}
            fill
            sizes="(max-width:780px) 100vw,50vw"
            priority
          />
        </div>
        <div>
          <div className="detail-meta">
            <Badge variant="secondary">{p.category.name}</Badge>
            {p.mode === "RESCUE" && <Badge>อิ่มคุ้ม ช่วยลดอาหารเหลือ</Badge>}
          </div>
          <Link className="help-text" href={`/store/${p.store.slug}`}>
            {p.store.name} {p.store.verified ? "✓" : ""}
          </Link>
          <h1>{p.name}</h1>
          {p.description && <p className="detail-description">{p.description}</p>}
          <div className="price">
            {money(p.price.current)}
            {p.price.active && (
              <>
                <del>{money(p.price.original)}</del>
                <Badge>ลด {p.price.discountPercent}%</Badge>
              </>
            )}
          </div>
          {p.price.upcoming && (
            <p className="help-text">
              ราคาถัดไป {money(p.price.upcoming.price)} เริ่ม{" "}
              {date(p.price.upcoming.at)} {time(p.price.upcoming.at)} น.
              ราคาปัจจุบันยังไม่เปลี่ยนจนถึงเวลาเริ่ม
            </p>
          )}
          <dl className="detail-facts">
            <div>
              <dt>สถานะร้าน</dt>
              <dd>{p.open ? "ร้านยืนยันเปิดอยู่" : "ยังไม่ยืนยันว่าเปิด"}</dd>
            </div>
            <div>
              <dt>จำนวนคงเหลือ</dt>
              <dd>{p.stock === null ? "ไม่ติดตามจำนวน" : p.stock === 0 ? "สินค้าหมด" : `${p.stock.toLocaleString("th-TH")} ชิ้น`}</dd>
            </div>
            {p.pickupStart && p.pickupEnd && (
              <div>
                <dt>เวลารับสินค้า</dt>
                <dd>
                  {pickupWindow(p.pickupStart, p.pickupEnd)}
                </dd>
              </div>
            )}
            {p.allergens && (
              <div>
                <dt>สารก่อภูมิแพ้</dt>
                <dd>{p.allergens}</dd>
              </div>
            )}
            {p.storage && (
              <div>
                <dt>การเก็บรักษา</dt>
                <dd>{p.storage}</dd>
              </div>
            )}
          </dl>
          {p.demo && !p.demoInteractive ? (
            <Alert>
              <AlertTitle>ยังไม่เปิดรับการจอง</AlertTitle>
              <AlertDescription>
                เลือกรายการอื่นจากร้านนี้
              </AlertDescription>
            </Alert>
          ) : !features.reservationsEnabled ? (
            <Alert>
              <AlertTitle>พักรับการจองออนไลน์ชั่วคราว</AlertTitle>
              <AlertDescription>
                {"ตรวจสอบสินค้าและเวลาเปิดของร้าน"}
              </AlertDescription>
            </Alert>
          ) : p.reservable && p.stock !== null && p.stock > 0 ? (
            <div className="form-panel">
              <ContextualForm
                title="ยืนยันการจอง"
                description={`${p.name} · ${money(p.price.current)} ต่อชิ้น · ราคายืนยันเมื่อจอง`}
                label={"จองสินค้า"}
                endpoint="/api/reservations"
                body={{ productId: p.id }}
                fields={[
                  {
                    name: "quantity",
                    label: "จำนวนที่ต้องการจอง",
                    type: "number",
                    value: 1,
                    min: 1,
                    max: p.stock ?? 99,
                    required: true,
                  },
                ]}
                submit={"จองสินค้า"}
                redirect="/reservations"
              />
              <p className="help-text mt-4">
                แสดงรหัสจองเมื่อรับสินค้า
              </p>
            </div>
          ) : (
            <Alert>
              <AlertTitle>
                {p.stock === 0 ? "สินค้าหมดแล้ว" : "ซื้อได้ที่ร้าน"}
              </AlertTitle>
              <AlertDescription>
                {p.stock === 0
                  ? "ลองดูสินค้าอื่นจากร้านนี้"
                  : "สินค้านี้ไม่เปิดรับจองออนไลน์ ตรวจสอบเวลาเปิดก่อนเดินทาง"}
              </AlertDescription>
            </Alert>
          )}
          <div className="location-panel">
            <h2>ร้านนี้อยู่ที่ไหน?</h2>
            <p>{p.location}</p>
            {p.marketSlug && (
              <Link
                href={`/markets/${p.marketSlug}/map?${new URLSearchParams({ ...(p.sessionId ? { session: p.sessionId } : {}), ...(p.stallCode ? { stall: p.stallCode } : {}) })}`}
              >
                ดูตำแหน่งในแผนผังตลาด →
              </Link>
            )}
            <Link href={`/store/${p.store.slug}`}>ดูรายละเอียดร้าน →</Link>
          </div>
        </div>
      </div>
      <details className="mt-10">
        <summary className="help-text cursor-pointer">
          แจ้งปัญหาเกี่ยวกับสินค้านี้
        </summary>
        <div className="form-panel mt-4">
          <ReportForm productId={p.id} />
        </div>
      </details>
    </div>
  );
}
