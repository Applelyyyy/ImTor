import Link from "next/link";
import { ArrowUpRight, Leaf, MapPin, Store } from "lucide-react";
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
          <div className="community-label">
            <span />
            ของดีใกล้ตัว ในรั้วแคมปัส
          </div>
          <h1>
            วันนี้กินอะไรดี?
            <br />
            มาเจอกันที่อิ่มต่อ
          </h1>
          <p>
            รวมร้านอร่อย ของน่าซื้อ และดีลดี ๆ รอบตัว
            <br className="desktop-only" />
            เลือกอิ่มในแบบคุณ พร้อมส่งต่อความคุ้มให้ทุกวัน
          </p>
          <SearchForm />
          <div className="hero-benefits">
            <span>
              <MapPin />
              หาร้านง่าย
            </span>
            <span>
              <Store />
              รู้ตลาดที่เปิด
            </span>
            <span>
              <Leaf />
              ช่วยลดอาหารเหลือ
            </span>
          </div>
        </div>
        <MarketPanel markets={venues} />
      </section>
      <section className="discovery shell">
        <div className="section-heading">
          <div>
            <h2>มื้อนี้ มีอะไรน่าอิ่ม</h2>
            <p>เลือกของที่ชอบ แล้วแวะไปรับที่ร้านได้เลย</p>
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
          <h2>ร้านเล็ก ๆ ความอร่อยใหญ่ ๆ</h2>
          <p>ให้คนในแคมปัสเจอร้านคุณง่ายขึ้น เปิดร้านบนอิ่มต่อได้เลย</p>
        </div>
        <Link href="/become-vendor">
          มาเปิดร้านด้วยกัน <ArrowUpRight size={19} />
        </Link>
      </section>
    </>
  );
}
