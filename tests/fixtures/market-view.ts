import type { MarketView } from "@/lib/contracts";
export const market: MarketView = {
  id: "market", slug: "market", name: "ตลาดสด", type: "SMALL", description: "", address: "กรุงเทพ", entrance: "ประตูหนึ่ง",
  latitude: 13, longitude: 100, timezone: "Asia/Bangkok", layoutImage: null, demo: false, sessions: [],
  stalls: [{ id: "stall", code: "A01", x: .5, y: .5, active: true, directions: "ใกล้ประตู", zone: "อาหาร", vendor: {
    slug: "store", productNames: ["ข้าวผัด"], name: "ข้าวอร่อย", status: "OPEN", verified: true, demo: false,
    products: [{ id: "product", name: "ข้าวผัด", imageUrl: "/test.jpg", price: { current: 9000, original: 10000, discountPercent: 10, active: true, upcoming: null } }],
  } }],
};
