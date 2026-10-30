import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { imageAspectRatio, normalizedPoint, zoneLabels } from "@/lib/market-map";
import { MarketMapCanvas } from "@/components/market-map-canvas";

const stalls = [
  { id: "one", code: "ก01", x: .25, y: .4, zone: "อาหาร", status: "available" as const },
  { id: "two", code: "ก02", x: .75, y: .6, zone: "อาหาร", status: "own" as const },
  { id: "three", code: "B1", x: .5, y: .8, zone: "เครื่องดื่ม", status: "unavailable" as const },
];
describe("shared market map geometry", () => {
  it("preserves uploaded image proportions and handles an invalid image size", () => {
    expect(imageAspectRatio(1200, 600)).toBe(2);
    expect(imageAspectRatio(600, 1200)).toBe(.5);
    expect(imageAspectRatio(0, 0)).toBe(4 / 3);
  });
  it("uses persisted normalized positions, clamping invalid/outside points", () => {
    expect(normalizedPoint(stalls[0])).toEqual({ x: .25, y: .4 });
    expect(normalizedPoint({ x: -1, y: 4 })).toEqual({ x: 0, y: 1 });
    expect(normalizedPoint({ x: NaN, y: Infinity })).toEqual({ x: .5, y: .5 });
  });
  it("derives zone labels consistently without inventing geographic positions", () => {
    expect(zoneLabels(stalls)).toEqual([
      { name: "อาหาร", x: .5, y: .335 },
      { name: "เครื่องดื่ม", x: .5, y: .7350000000000001 },
    ]);
  });
});
it("renders native keyboard buttons, status text, selected state, and a non-geographic schematic", () => {
  const html = renderToStaticMarkup(<MarketMapCanvas name="ตลาด" stalls={stalls} selectedId="two" onSelect={() => {}} entrance="ประตูห้องสมุด" />);
  expect(html).toContain("แผนผังตลาด");
  expect(html).toContain('data-schematic="true"');
  expect(html).not.toContain("ตำแหน่งจริงที่ตรวจสอบแล้ว");
  expect(html).toContain("ประตูห้องสมุด");
  expect(html).toContain('data-stall-id="two"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("ล็อกของคุณ");
  expect(html).toContain("ไม่ว่าง");
  expect(html).toContain("เลือกได้");
  expect(html).toContain("คืนมุมมอง");
  expect(html).toContain("โซน อาหาร");
  expect(html).toContain("left:25%;top:40%");
});
it("does not invent an entrance when none is known", () => {
  const html = renderToStaticMarkup(<MarketMapCanvas name="ตลาด" stalls={[]} onSelect={() => {}} />);
  expect(html).toContain("ยังไม่มีล็อกในผังนี้");
  expect(html).not.toContain("ทางเข้า:");
});

it("public and admin maps share the same normalized plane and schematic fallback", async () => {
  const { LayoutEditor } = await import("@/components/layout-editor");
  const html = renderToStaticMarkup(<LayoutEditor marketId="market" image={null} zones={[{ id: "zone", name: "อาหาร" }]}
    stalls={[{ id: "one", code: "ก01", x: .25, y: .4, zoneId: "zone", directions: "", active: true }]} />);
  expect(html).toContain("data-layout-canvas");
  expect(html).toContain("data-map-canvas");
  expect(html).toContain("แผนผังตลาด");
  expect(html).toContain('data-schematic="true"');
  expect(html).toContain("left:25%;top:40%");
  expect(html).not.toContain("height:560px");
});

it("public discovery does not imply permission, bookable vacancies, or a merchant's own stall", () => {
  const html = renderToStaticMarkup(<MarketMapCanvas name="ตลาด" stalls={stalls.slice(0, 1)} mode="public" onSelect={() => {}} />);
  expect(html).toContain("ยังไม่ลงทะเบียน");
  expect(html).not.toContain("พื้นที่จริงว่าง");
  expect(html).not.toContain("เลือกได้");
  expect(html).not.toContain("ล็อกของคุณ");
});

it("keeps busy markers native-disabled without changing their availability status", () => {
  const html = renderToStaticMarkup(<MarketMapCanvas name="ตลาด" stalls={stalls} disabled onSelect={() => {}} />);
  expect(html).toMatch(/disabled="" data-map-stall="" data-stall-id="one" data-status="available"/);
  expect(html).toMatch(/disabled="" data-map-stall="" data-stall-id="two" data-status="own"/);
  expect(html).toContain("ล็อกของคุณ");
});

it("renders a shared-position chooser trigger instead of hiding duplicate stall targets", () => {
  const same = [{ ...stalls[0] }, { ...stalls[1], x: stalls[0].x, y: stalls[0].y }];
  const html = renderToStaticMarkup(<MarketMapCanvas name="ตลาด" stalls={same} selectedId="two" onSelect={() => {}} />);
  expect(html).toContain('data-map-cluster="2"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("2 ล็อก · แตะเลือก");
  expect(html).toContain("ก01, ก02");
  expect(html).toContain('data-selected="true"');
  expect(html).toContain("left:25%;top:40%");
  expect((html.match(/data-map-cluster="2"/g) ?? []).length).toBe(1);
});
