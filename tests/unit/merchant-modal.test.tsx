import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
import { MerchantProductManager } from "@/components/merchant-product-manager";
import { MerchantProductForm } from "@/components/merchant-product-form";
const product = { id: "product", name: "ข้าว", imageUrl: "/image.jpg", price: 999900, categoryId: "food", description: "", mode: "REGULAR", reservable: false, stock: 100, pickupStart: null, pickupEnd: null, allergens: null, storage: null };
describe("compact merchant product editor", () => {
  it("loads actual tracked stock independently of reservations", () => {
    const html = renderToStaticMarkup(<MerchantProductForm storeId="store" categories={[{id:"food",name:"อาหาร"}]} product={product} />);
    expect(html).toContain('value="100"');
    expect(html).toContain("ติดตามจำนวนสินค้า");
    expect(html).not.toContain("ไม่ต้องระบุจำนวน");
  });
  it("keeps tracked zero editable and advanced reservation fields disclosed", () => {
    const html = renderToStaticMarkup(<MerchantProductForm storeId="store" categories={[{id:"food",name:"อาหาร"}]} product={{...product,stock:0}} />);
    expect(html).toContain('value="0"');
    expect(html).toContain('min="0"');
    expect(html).toMatch(/<details[^>]*>[\s\S]*เปิดรับจองออนไลน์/);
  });
  it("renders explicit tracked, sold-out and untracked rows without inline management forms", () => {
    const products = [100, 0, null].map((stock,index) => ({ ...product, id:`product-${index}`,stock,published:true,archived:false,currentPrice:999900,discounts:[],demo:false }));
    const html = renderToStaticMarkup(<MerchantProductManager storeId="store" categories={[{id:"food",name:"อาหาร"}]} products={products} />);
    expect(html).toContain("คงเหลือ 100 ชิ้น");
    expect(html).toContain("สินค้าหมด");
    expect(html).toContain("ไม่ติดตามจำนวน");
    expect(html).toContain("฿9,999");
    const rows = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.match(/<button/g)).toHaveLength(2);
      expect(row).not.toContain("<form");
      expect(row).not.toContain('role="status"');
    }
  });
  it("puts management forms behind contextual surfaces, not inside list rows", () => {
    const path = "src/components/merchant-product-manager.tsx";
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const source = readFileSync(path,"utf8");
    expect(source).toContain("DropdownMenuTrigger");
    expect(source).toContain("AppDialog");
    expect(source).not.toContain("ApiButton");
  });
});
it('keeps mobile photo preview and upload actions in one compact row',()=>{expect(readFileSync('src/components/merchant-product-manager.module.css','utf8')).toContain('flex-direction: row');});
