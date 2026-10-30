import { merchantStore, NoStore } from "@/components/merchant";
import { categories } from "@/lib/queries";
import { MerchantProductForm } from "@/components/merchant-product-form";
import { PageHeading } from "@/components/marketplace";
export default async function NewProduct() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const cats = await categories();
  return <><PageHeading title="เพิ่มสินค้า" description="ภาพ ชื่อ ราคา — เริ่มขายได้เลย" /><div className="form-panel"><MerchantProductForm storeId={s.id} categories={cats.map(({ id, name }) => ({ id, name }))} /></div></>;
}
