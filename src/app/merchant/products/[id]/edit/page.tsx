import Link from "next/link";
import { notFound } from "next/navigation";
import { merchantStore, NoStore } from "@/components/merchant";
import { categories } from "@/lib/queries";
import { MerchantProductForm } from "@/components/merchant-product-form";
import { MerchantDiscountForm } from "@/components/merchant-discount-form";
import { InventoryControls } from "@/components/inventory-controls";
import { ApiButton } from "@/components/forms";
import { PageHeading, date, time } from "@/components/marketplace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";
export default async function EditProduct({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const { id } = await params;
  const p = s.products.find((p) => p.id === id);
  if (!p) notFound();
  const [cats, query] = await Promise.all([categories(), searchParams]);
  return <>
    <PageHeading title={`แก้ไข ${p.name}`}><Button asChild variant="outline"><Link href="/merchant/products">กลับไปสินค้า</Link></Button></PageHeading>
    {query.created === "1" && <Alert className="mb-6"><AlertTitle>เพิ่มสินค้าเรียบร้อยแล้ว</AlertTitle><AlertDescription>ปรับข้อมูลต่อได้ที่นี่{p.published && !p.archived && !s.hidden && !s.suspended && <Link className="link-button block" href={`/product/${p.id}`}>ดูสินค้าที่ลูกค้าเห็น</Link>}</AlertDescription></Alert>}
    <div className="stack">
      <section className="form-panel"><MerchantProductForm key={`${p.id}:${p.stock}:${p.mode}:${p.reservable}:${p.pickupStart?.getTime()}:${p.pickupEnd?.getTime()}`} storeId={s.id} categories={cats.map(({ id, name }) => ({ id, name }))} product={{ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, categoryId: p.categoryId, description: p.description, mode: p.mode, reservable: p.reservable, stock: p.stock, pickupStart: p.pickupStart?.toISOString() ?? null, pickupEnd: p.pickupEnd?.toISOString() ?? null, allergens: p.allergens, storage: p.storage }} /></section>
      {p.stock !== null && <section className="content-panel"><h2>จำนวนสินค้า</h2><InventoryControls productId={p.id} available={p.stock} /></section>}
      <details className="form-panel merchant-optional"><summary>ตั้งส่วนลด{p.discounts.length ? ` (${p.discounts.length} ช่วง)` : ""}</summary>
        <div className="mt-5 flex flex-col gap-5">
          {p.discounts.map((d) => <div className="merchant-discount-row" key={d.id}><div><strong>{d.kind === "FIXED" ? `ขาย ${money(d.value)}` : d.kind === "FINAL_PERCENT" ? `ขาย ${d.value}% ของราคาปกติ` : `ลด ${d.value}%`}</strong><p>{date(d.startsAt.toISOString())} {time(d.startsAt.toISOString())} – {date(d.endsAt.toISOString())} {time(d.endsAt.toISOString())}</p></div><ApiButton endpoint={`/api/products/${p.id}/discounts/${d.id}`} method="DELETE" confirmMessage="ลบช่วงลดราคานี้? ราคาที่จองไว้แล้วไม่เปลี่ยน">ลบช่วงลด</ApiButton></div>)}
          <MerchantDiscountForm productId={p.id} />
        </div>
      </details>
    </div>
  </>;
}
