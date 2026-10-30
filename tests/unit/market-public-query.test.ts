import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ products: vi.fn(), markets: vi.fn(), rules: vi.fn(), settings: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: mocks.products }, marketVenue: { findMany: mocks.markets }, discountRule: { findMany: mocks.rules }, systemSetting: { findMany: mocks.settings } } }));
vi.mock("@/services/reservations", () => ({ ReservationService: { expire: vi.fn() } }));
vi.mock("@/services/schedule", () => ({ MarketScheduleService: { ensureSessions: vi.fn(), status: () => "OPEN" } }));
import { markets, products } from "@/lib/queries";
import { searchStalls } from "@/lib/stall-search";
import type { StallView } from "@/lib/contracts";
const now = new Date();
const session = { id: "session", date: "2099-01-01", startsAt: new Date(now.getTime()-60000), endsAt: new Date(now.getTime()+3600000), status: "OPEN", market: { name: "ตลาดทอง", slug: "gold" } };
const stall = { id: "stall", code: "A07", zone: { name: "อาหาร" } };
const product = { id: "product", storeId: "store", name: "ข้าวผัด", description: "", imageUrl: "/test.jpg", mode: "RESCUE", price: 10000, discounts: [], reservable: false, stock: 3, allergens: null, storage: null, pickupStart: null, pickupEnd: null, demoBatchId: null, sessionId: "session", category: { id: "food", name: "อาหาร" }, store: { id: "store", slug: "store", name: "ครัวแม่", verified: true, kind: "MARKET", attendances: [{ status: "OPEN", sessionId: "session", session, assignment: { stall } }] } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.products.mockResolvedValue([product]); mocks.settings.mockResolvedValue([]);
  mocks.rules.mockResolvedValue([{ kind: "PERCENT_OFF", value: 10, startsAt: new Date(now.getTime()-3600000), endsAt: new Date(now.getTime()+3600000) }]);
});
describe("public market search and prices", () => {
  it.each(["  ตลาดทอง  ", "A07", "อาหาร", "ข้าวผัด", "ครัวแม่"])("finds only the public projected location/name for %s", async (q) => {
    expect(await products({ q })).toHaveLength(1);
    const where = mocks.products.mock.calls[0][0].where;
    expect(where.published).toBe(true); expect(where.archived).toBe(false);
    expect(where.store).toEqual({ suspended: false, hidden: false });
    expect(where.OR[0]).toEqual({ name: { contains: q.trim(), mode: "insensitive" } });
    expect(where.OR).toEqual(expect.arrayContaining([expect.objectContaining({ store: { attendances: expect.any(Object) } })]));
  });
  it("does not let trimmed rescue filters bypass the public feature flag", async () => {
    mocks.settings.mockResolvedValue([{ key: "foodRescueEnabled", value: false }]);
    expect(await products({ filter: " rescue " })).toEqual([]);
    expect(mocks.products).not.toHaveBeenCalled();
  });
  it("does not match a different attendance when the product belongs to the selected session", async () => {
    const otherAttendance = { ...product.store.attendances[0], sessionId: "different-session", session: { ...session, id: "different-session", market: { name: "ตลาดเก่า", slug: "old" } } };
    mocks.products.mockResolvedValue([{ ...product, store: { ...product.store, attendances: [...product.store.attendances, otherAttendance] } }]);
    expect(await products({ q: "ตลาดเก่า" })).toHaveLength(0);
  });
  it("prices eligible map products with product + global rules and hides products from another session", async () => {
    mocks.markets.mockResolvedValue([{ id: "market", slug: "market", name: "ตลาดทอง", timezone: "Asia/Bangkok", sessions: [{ ...session, attendances: [] }], stalls: [{ ...stall, active: true, x: .3, y: .3, directions: "", assignments: [{ attendance: { sessionId: "session", status: "OPEN", store: { id: "store", slug: "store", name: "ครัวแม่", products: [product, { ...product, id: "other", sessionId: "other" }] } }, verified: true }] }] }]);
    const result = await markets("session");
    expect(result[0].stalls[0].vendor?.products).toHaveLength(1);
    expect(result[0].stalls[0].vendor?.productNames).toEqual(["ข้าวผัด"]);
    expect(result[0].stalls[0].vendor?.products[0].price).toMatchObject({ current: 9000, original: 10000 });
    expect(mocks.products.mock.calls[0][0].select).toMatchObject({ price: true, discounts: true });
  });
  it("does not let twelve newer wrong-session products hide an older eligible price preview", async () => {
    const wrong = Array.from({ length: 12 }, (_, index) => ({ ...product, id: `wrong-${index}`, sessionId: "other" }));
    const older = { ...product, id: "older-eligible", name: "สินค้าในรอบนี้" };
    mocks.products.mockResolvedValue([...wrong, older]);
    mocks.markets.mockResolvedValue([{ id: "market", slug: "market", name: "ตลาดทอง", timezone: "Asia/Bangkok", sessions: [{ ...session, attendances: [] }], stalls: [{ ...stall, active: true, x: .3, y: .3, directions: "", assignments: [{ attendance: { sessionId: "session", status: "OPEN", store: { id: "store", slug: "store", name: "ครัวแม่", products: wrong } }, verified: true }] }] }]);
    const result = await markets("session");
    expect(result[0].stalls[0].vendor?.products.map((item) => item.id)).toEqual(["older-eligible"]);
    expect(result[0].stalls[0].vendor?.products[0].price.current).toBe(9000);
    expect(result[0].stalls[0].vendor?.productNames).toEqual(["สินค้าในรอบนี้"]);
  });
  it("matches map product, vendor, zone and code with trimmed Thai/English input but never inactive stalls", () => {
    const rows = [{ id: "one", active: true, code: "A07", zone: "อาหาร", vendor: { name: "ครัวแม่", products: [{ name: "ข้าวผัด" }], productNames: ["ข้าวผัด", "ก๋วยเตี๋ยว"] } }, { id: "two", active: false, code: "A08", zone: "อาหาร", vendor: null }] as StallView[];
    for (const q of [" ข้าวผัด ", "ครัวแม่", "อาหาร", "a07", "ก๋วยเตี๋ยว"]) expect(searchStalls(rows, q).map((s) => s.id)).toEqual(["one"]);
    expect(searchStalls(rows, "ไม่มี")).toEqual([]);
  });
});
