import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
import { ApiForm, ApiButton } from "@/components/forms";
import { AttendanceForm } from "@/components/attendance-form";
import type { MarketView } from "@/lib/contracts";

describe("pre-hydration interaction guards", () => {
  it("does not expose enabled client-only submit controls in server HTML", () => {
    const html = renderToStaticMarkup(createElement(ApiForm, { endpoint: "/api/profile", fields: [{name:"name",label:"ชื่อ",required:true}] }));
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""/);
    const button = renderToStaticMarkup(<ApiButton endpoint="/api/products/example">พักขาย</ApiButton>);
    expect(button).toMatch(/<button[^>]*disabled=""/);
  });
  it("keeps dependent market/session selectors disabled until their change handlers exist", () => {
    const market = { id:"market", name:"ตลาด", sessions:[], stalls:[] } as unknown as MarketView;
    const html = renderToStaticMarkup(createElement(AttendanceForm, {storeId:"store",markets:[market]}));
    expect(html.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
  });
});
