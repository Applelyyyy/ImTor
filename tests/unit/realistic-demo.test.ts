import { describe, expect, it } from "vitest";
import { parseDemoConfig } from "@/services/demo-state";
import { DEMO_ASSET_KEYS, DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_SHOPS } from "@/data/demo-catalog";

describe("realistic demo config and catalog", () => {
  it("normalizes bounded typed defaults without accepting unknown or coerced inputs", () => {
    const config = parseDemoConfig({ idempotencyKey: "unit-key" });
    expect(config).toMatchObject({ stores: 30, products: 150, customers: 100, reservations: 250, historyDays: 21, futureDays: 14, markets: 2, zones: 8, stalls: 80, useImages: true, visitorReservations: true });
    expect(parseDemoConfig(config)).toEqual(config);
    for (const value of [null, [], { stores: "30" }, { products: 0 }, { reservations: -1 }, { historyDays: 367 }, { unknown: true }, { useImages: "true" }]) expect(() => parseDemoConfig(value)).toThrow();
  });
  it("has 40 precise products, 30 varied shops, 18 categories and 50 unique asset keys", () => {
    expect(DEMO_PRODUCTS).toHaveLength(40);
    expect(DEMO_SHOPS).toHaveLength(30);
    expect(DEMO_CATEGORIES).toHaveLength(18);
    expect(new Set(DEMO_ASSET_KEYS).size).toBe(50);
    expect(new Set(DEMO_SHOPS.map((shop) => shop.name)).size).toBe(30);
    for (const product of DEMO_PRODUCTS) {
      expect(DEMO_CATEGORIES.some((category) => category.key === product.category)).toBe(true);
      expect(DEMO_SHOPS.some((shop) => shop.categories.includes(product.category))).toBe(true);
      expect(product.subject.length).toBeGreaterThan(15);
    }
  });
});
