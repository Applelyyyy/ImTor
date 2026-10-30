import { describe, it, expect } from "vitest";
import {
  productSchema,
  attendanceSchema,
  ruleSchema,
  discountSchema,
} from "@/lib/validation";
describe("untrusted marketplace input", () => {
  const product = {
    storeId: "store",
    name: "ชาไทย",
    imageUrl: "/images/tea.jpg",
    price: 3500,
    categoryId: "drinks",
  };
  it("accepts browse-only listings without invented stock", () => {
    expect(productSchema.parse(product).stock).toBeUndefined();
  });
  it("rejects reservations without pickup or managed inventory", () => {
    expect(
      productSchema.safeParse({ ...product, reservable: true }).success,
    ).toBe(false);
  });
  it("rejects negative prices and float satang", () => {
    expect(productSchema.safeParse({ ...product, price: -1 }).success).toBe(
      false,
    );
    expect(productSchema.safeParse({ ...product, price: 1.5 }).success).toBe(
      false,
    );
  });
  it("rejects equal repeating discount boundaries", () => {
    expect(
      discountSchema.safeParse({
        kind: "FIXED",
        value: 3000,
        startsAt: "2026-10-30T10:00:00Z",
        endsAt: "2026-10-31T10:00:00Z",
        repeatStart: "19:00",
        repeatEnd: "19:00",
      }).success,
    ).toBe(false);
  });
  it("requires rescue safety information", () => {
    expect(
      productSchema.safeParse({ ...product, mode: "RESCUE" }).success,
    ).toBe(false);
  });
  it("requires authorization affirmation to claim a stall", () => {
    expect(
      attendanceSchema.safeParse({
        storeId: "s",
        sessionId: "s",
        stallId: "s",
        authorized: false,
      }).success,
    ).toBe(false);
  });
  it("rejects ambiguous or invalid recurrence", () => {
    expect(
      ruleSchema.safeParse({ weekday: 9, opens: "25:00", closes: "21:00" })
        .success,
    ).toBe(false);
  });
});
