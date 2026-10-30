import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { products, markets, categories } from "@/lib/queries";
import {
  MarketPanel,
  SearchForm,
  ProductGrid,
  CategoryFilters,
} from "@/components/marketplace";
export default async function Home() {
  const [items, venues, cats] = await Promise.all([
    products(),
    markets(),
    categories(),
  ]);
  return (
    <>
      <section className="home-hero shell">
        <div className="hero-copy">
          <h1 className="font-display">วันนี้มีอะไรน่าซื้อ?</h1>
          <SearchForm />
        </div>
        <MarketPanel markets={venues} />
      </section>
      <section className="discovery shell">
        <div className="section-heading">
          <div>
            <h2 className="font-display">สินค้าและร้านค้า</h2>
          </div>
          <Link href="/explore">
            สำรวจทั้งหมด <ArrowUpRight size={18} />
          </Link>
        </div>
        <CategoryFilters categories={cats} />
        <ProductGrid items={items.slice(0, 12)} />
      </section>
      <section className="vendor-banner shell">
        <div className="vendor-banner-icon">
          <Store />
        </div>
        <div>
          <h2>เปิดร้านกับอิ่มต่อ</h2>
        </div>
        <Link href="/become-vendor">
          เปิดร้าน <ArrowUpRight size={19} />
        </Link>
      </section>
    </>
  );
}
