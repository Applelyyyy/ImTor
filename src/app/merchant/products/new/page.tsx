import { merchantStore, NoStore, productFields } from "@/components/merchant";
import { categories } from "@/lib/queries";
import { ApiForm } from "@/components/forms";
import { PageHeading } from "@/components/marketplace";
export default async function NewProduct() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  const cats = await categories();
  return (
    <>
      <PageHeading
        title="เพิ่มสินค้ามาอิ่มต่อ"
        description="รูปสวย ๆ ชื่อชัด ๆ และราคาจริง ลูกค้าก็พร้อมแวะมา"
      />
      <div className="form-panel">
        <ApiForm
          endpoint="/api/products"
          body={{ storeId: s.id }}
          fields={productFields(cats)}
          advancedFrom={3}
          submit="เผยแพร่สินค้า"
          redirect="/merchant/products"
        />
      </div>
    </>
  );
}
