import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { reportSchema } from "@/lib/report-validation";
import { ReportForm } from "@/components/report-form";

describe("shared report validation and accessible form", () => {
  it.each(["ก", "เน่า", "เสีย", "เหม็น", "ไม่ดี", "ของหมด", "ร้านปิด", "ราคาไม่ตรง", "สินค้ามีกลิ่นผิดปกติ กรุณาตรวจสอบ", "ก".repeat(2000)])("trims and accepts nonempty reason (%s)", (reason) => {
    expect(reportSchema.parse({ productId: "product", reason: ` \n${reason}\t ` })).toEqual({ productId: "product", reason });
  });
  it.each(["", " \n\t ", null, undefined, 3])("returns natural Thai validation for empty or malformed input (%s)", (reason) => {
    const parsed = reportSchema.safeParse({ productId: "product", reason });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe("กรุณาระบุปัญหาที่พบ");
  });
  it("rejects payloads beyond the report-specific maximum", () => {
    const parsed = reportSchema.safeParse({ productId: "product", reason: "ก".repeat(2001) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe("รายละเอียดปัญหาต้องไม่เกิน 2,000 ตัวอักษร");
  });
  it("associates the report label, declares its required state and disables pre-hydration submission", () => {
    const html = renderToStaticMarkup(<ReportForm productId="product" />);
    const id = html.match(/<textarea[^>]*\sid="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("ส่งรายงาน");
  });
});
