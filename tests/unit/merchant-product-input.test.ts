import { describe, expect, it } from "vitest";
import { merchantProductInput, type MerchantProductDraft } from "@/lib/merchant-product-input";
const draft: MerchantProductDraft = { name: "ข้าว", imageUrl: "/image.jpg", price: "45.50", description: "", categoryId: "food", mode: "REGULAR", reservable: true, tracking: true, quantity: "10", pickupStart: "2026-10-30T10:00", pickupEnd: "2026-10-30T12:00", allergens: "", storage: "" };
describe("merchant product mutation boundary", () => {
  it("converts baht to integer satang and preserves Bangkok pickup time", () => {
    expect(merchantProductInput(draft)).toMatchObject({ price: 4550, stock: 10, pickupStart: "2026-10-30T03:00:00.000Z" });
  });
  it("never resubmits absolute stock during ordinary edits", () => {
    expect(merchantProductInput(draft, { reservable: true })).not.toHaveProperty("stock");
  });
  it("does not resubmit unchanged pickup windows with lost seconds", () => {
    const value = merchantProductInput(draft, { reservable: true, pickupStart: "2026-10-30T03:00:32.123Z", pickupEnd: "2026-10-30T05:00:32.123Z" });
    expect(value).not.toHaveProperty("pickupStart");
    expect(value).not.toHaveProperty("pickupEnd");
  });
  it("sends target and observed balance only when inventory actually changes", () => {
    expect(merchantProductInput({ ...draft, quantity: "50", reservable: false }, { reservable: false, stock: 100 }, "edit-key")).toMatchObject({ stock: 50, expectedStock: 100, stockAdjustmentKey: "edit-key" });
    expect(merchantProductInput(draft, { reservable: true, stock: 10 }, "edit-key")).not.toHaveProperty("stock");
  });
  it("does not fabricate quantities or pickup windows for display-only listings", () => {
    const value = merchantProductInput({ ...draft, reservable: false, tracking: false, pickupStart: "", pickupEnd: "" });
    expect(value).toHaveProperty("stock", null);
    expect(value.pickupStart).toBeNull();
  });
  it("persists display-only tracked inventory including zero and explicit no-tracking", () => {
    expect(merchantProductInput({ ...draft, reservable: false, quantity: "100" })).toHaveProperty("stock", 100);
    expect(merchantProductInput({ ...draft, quantity: "0" })).toHaveProperty("stock", 0);
    expect(merchantProductInput({ ...draft, reservable: false, tracking: false }, { reservable: false, stock: 100 }, "disable-key")).toMatchObject({ stock: null, expectedStock: 100, stockAdjustmentKey: "disable-key" });
    expect(() => merchantProductInput({ ...draft, tracking: false })).toThrow();
    for (const quantity of ["", " ", "NaN", "-1", "1000001", "1.5"])
      expect(() => merchantProductInput({ ...draft, reservable: false, quantity })).toThrow();
    expect(() => merchantProductInput({ ...draft, quantity: "50" }, { reservable: true, stock: 100 })).toThrow();
  });
  it("rejects malformed quantity, money and reversed pickup windows", () => {
    expect(() => merchantProductInput({ ...draft, quantity: "1.5" })).toThrow();
    expect(() => merchantProductInput({ ...draft, price: "-1" })).toThrow();
    expect(() => merchantProductInput({ ...draft, pickupEnd: "2026-10-30T09:00" })).toThrow();
  });
});
