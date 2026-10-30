import { products, categories, markets } from "@/lib/queries";
import {
  PageHeading,
  SearchForm,
  CategoryFilters,
  ProductGrid,
} from "@/components/marketplace";
export const metadata = { title: "สินค้าและร้านค้า" };
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const [items, cats, venues] = await Promise.all([
    products(p),
    categories(),
    markets(),
  ]);
  return (
    <div className="shell page">
      <PageHeading title="สินค้าและร้านค้า" />
      <SearchForm q={p.q} />
      <form className="inline-filter">
        <input type="hidden" name="q" value={p.q || ""} />
        <label htmlFor="market-filter">เลือกตลาด</label>
        <select id="market-filter" name="market" defaultValue={p.market || ""}>
          <option value="">ทุกตลาดและร้านประจำ</option>
          {venues.map((m) => (
            <option key={m.id} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="submit">ดูสินค้า</button>
      </form>
      <CategoryFilters
        categories={cats}
        active={p.category}
        filter={p.filter}
        q={p.q}
        market={p.market}
      />
      <p className="result-count" role="status">
        {p.q ? `ผลการค้นหา “${p.q}” · ` : ""}
        {items.length} รายการ
      </p>
      <ProductGrid items={items} />
    </div>
  );
}
