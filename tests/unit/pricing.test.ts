import { describe, expect, it } from "vitest";
import { PricingService, type DiscountInput } from "@/services/pricing";
const now = new Date("2026-01-05T12:00:00Z");
const base: DiscountInput = {
  id: "a",
  kind: "FIXED",
  value: 3000,
  startsAt: "2026-01-05T11:00:00Z",
  endsAt: "2026-01-05T14:00:00Z",
  priority: 0,
};
describe("integer satang pricing", () => {
  it("never discounts an ordinary listing without rules", () => {
    expect(PricingService.calculate(10000, [], now)).toEqual({
      original: 10000,
      current: 10000,
      discountPercent: 0,
      active: false,
      upcoming: null,
    });
  });
  it("distinguishes final percentage from percent off", () => {
    expect(
      PricingService.calculate(
        10000,
        [{ ...base, kind: "FINAL_PERCENT", value: 30 }],
        now,
      ),
    ).toMatchObject({ current: 3000, discountPercent: 70, active: true });
    expect(
      PricingService.calculate(
        10000,
        [{ ...base, kind: "PERCENT_OFF", value: 30 }],
        now,
      ).current,
    ).toBe(7000);
  });
  it("uses start-inclusive and end-exclusive boundaries", () => {
    expect(
      PricingService.calculate(10000, [base], new Date(base.startsAt)).active,
    ).toBe(true);
    expect(
      PricingService.calculate(10000, [base], new Date(base.endsAt)).active,
    ).toBe(false);
  });
  it("selects highest priority, then cheapest deterministically without mutating input", () => {
    const rules = [
      { ...base, id: "b", value: 2000 },
      { ...base, id: "z", value: 4000, priority: 1 },
    ];
    expect(PricingService.calculate(10000, rules, now).current).toBe(4000);
    expect(rules[0].id).toBe("b");
    expect(
      PricingService.calculate(
        10000,
        [...rules, { ...base, id: "x", value: 1500, priority: 1 }],
        now,
      ).current,
    ).toBe(1500);
  });
  it("calculates repeating overnight windows in the configured timezone", () => {
    const overnight = {
      ...base,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-02-01T00:00:00Z",
      repeatStart: "22:00",
      repeatEnd: "02:00",
      timezone: "Asia/Bangkok",
    };
    expect(
      PricingService.calculate(
        10000,
        [overnight],
        new Date("2026-01-05T18:59:59Z"),
      ).active,
    ).toBe(true);
    expect(
      PricingService.calculate(
        10000,
        [overnight],
        new Date("2026-01-05T19:00:00Z"),
      ).active,
    ).toBe(false);
    expect(PricingService.calculate(10000, [overnight], now).upcoming).toEqual({
      at: "2026-01-05T15:00:00.000Z",
      price: 3000,
    });
  });
  it("previews upcoming rules at the effective start, with the same priority resolver", () => {
    expect(
      PricingService.calculate(10000, [base], new Date("2026-01-05T10:00:00Z"))
        .upcoming,
    ).toEqual({ at: "2026-01-05T11:00:00.000Z", price: 3000 });
  });
  it("rounds to integer satang without floating point multiplication errors", () => {
    expect(
      PricingService.calculate(
        10001,
        [{ ...base, kind: "FINAL_PERCENT", value: 33 }],
        now,
      ).current,
    ).toBe(3300);
  });
  it("ignores global fixed prices above a cheap listing instead of failing the marketplace", () => {
    expect(
      PricingService.calculate(
        1000,
        [{ ...base, value: 3000, priority: 10 }],
        now,
      ),
    ).toMatchObject({ current: 1000, active: false });
    expect(
      PricingService.calculate(
        1000,
        [
          { ...base, value: 3000, priority: 10 },
          { ...base, id: "cheap", value: 500 },
        ],
        now,
      ).current,
    ).toBe(500);
  });
  it("rejects invalid prices, values and malformed repeat windows", () => {
    expect(() => PricingService.calculate(-1, [], now)).toThrow();
    expect(() =>
      PricingService.calculate(10000, [{ ...base, value: -1 }], now),
    ).toThrow();
    expect(() =>
      PricingService.calculate(
        10000,
        [{ ...base, kind: "PERCENT_OFF", value: 101 }],
        now,
      ),
    ).toThrow();
    expect(() =>
      PricingService.calculate(10000, [{ ...base, repeatStart: "19:00" }], now),
    ).toThrow();
  });
});
