import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { StallMap } from "@/components/stall-map";
import { market } from "../fixtures/market-view";


describe("contextual market surfaces", () => {
  it("renders the selected stall with authoritative price and a named close action inside the map workspace", () => {
    const html = renderToStaticMarkup(<StallMap market={market} selected="A01" />);
    expect(html).toContain("฿90");
    expect(html).toContain('data-map-workspace=""');
    expect(html).toContain('aria-label="ปิดรายละเอียดล็อก"');
    expect(html).toContain("destination=13,100");
    expect(html).toMatch(/class="stall-marker occupied selected"[^>]*aria-pressed="true"/);
  });
  it("places one search results surface before the map and supports explicit Enter submission", () => {
    const html = renderToStaticMarkup(<StallMap market={market} />);
    expect(html).toContain('role="search"');
    expect(html).toContain('type="submit"');
    expect(html.indexOf('aria-label="ผลการค้นหาร้านและล็อก"')).toBeLessThan(html.indexOf('data-map-workspace=""'));
    expect(html.match(/class="stall-list-item/g)).toHaveLength(1);
  });
  it("keeps the authorized server query and replaces the create navigation with contextual management", () => {
    const page = readFileSync("src/app/admin/markets/page.tsx", "utf8");
    expect(page.indexOf("await requireAdmin()")).toBeLessThan(page.indexOf("await db.marketVenue.findMany"));
    expect(page).toContain("MarketManagement");
    expect(page).not.toContain('href="/admin/markets/new"');
  });
});
