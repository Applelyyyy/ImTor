import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StallMap } from "@/components/stall-map";
import { market } from "../fixtures/market-view";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(path, "utf8");
describe("realistic demo presentation boundaries", () => {
  it("uses ordinary booking controls while retaining server-controlled batch eligibility", () => {
    const source = read("src/app/product/[id]/page.tsx");
    expect(source).not.toContain('name: "demoAcknowledged"');
    expect(source).toContain('endpoint="/api/reservations"');
    expect(source).toContain("p.demoInteractive");
    expect(source).toContain("ยังไม่เปิดรับการจอง");
  });
  it("derives interactivity from private persisted batch configuration and environment", () => {
    const source = read("src/lib/queries.ts");
    expect(source).toContain('process.env.DEMO_MODE !== "true"');
    expect(source).toContain('`demo:${id}`');
    expect(source).toContain("visitorReservations === true");
  });
  it("retains the attendance session in store and product map links", () => {
    expect(read("src/app/store/[slug]/page.tsx")).toContain("session: a.sessionId");
    expect(read("src/app/product/[id]/page.tsx")).toContain("session: p.sessionId");
  });
  it("uses stored product IDs for map previews rather than fictional navigation", () => {
    const demoMarket = { ...market, latitude: null, longitude: null, stalls: market.stalls.map((stall) => ({ ...stall, vendor: stall.vendor ? { ...stall.vendor, demo: true } : null })) };
    const html = renderToStaticMarkup(createElement(StallMap, { market: demoMarket, selected: "A01" }));
    expect(html).toContain('href="/product/product"');
    expect(html).toContain("ข้าวผัด");
    expect(html).not.toContain("ร้านสาธิตและตำแหน่งสมมติ ไม่ใช่สถานที่จริง");
    expect(html).not.toContain("google.com/maps/dir");
  });
  it("provides inspectable administrative data beyond original row limits", () => {
    for (const page of ["users", "stores", "products", "reservations"]) {
      const source = read(`src/app/admin/${page}/page.tsx`);
      expect(source).toContain("take: 1000");
      expect(source).toContain("searchValues=");
      expect(source).toContain("total={total}");
    }
  });
  it("reports persisted stages and accurately labels image reprocessing", () => {
    const source = read("src/components/demo-control-panel.tsx");
    expect(source).toContain('"MEDIA", "DATA", "VALIDATE"');
    expect(source).toContain("state.message");
    expect(source).toContain("ไม่ใช่การสร้างภาพ AI ใหม่");
    expect(source).not.toContain("setInterval");
    expect(source).toContain("acknowledgeVisitorReservations: true");
  });
});
