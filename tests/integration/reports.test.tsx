import "./guard";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("next-auth", () => ({ getServerSession: async () => session.userId ? { user: { id: session.userId } } : null }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), redirect: () => { throw new Error("redirect"); } }));
import { db } from "@/lib/db";
import { POST, GET } from "@/app/api/[...path]/route";
import Reports from "@/app/admin/reports/page";

const tag = `reports-test-${randomUUID()}`;
let customer: Awaited<ReturnType<typeof db.user.create>>;
let admin: typeof customer;
let product: Awaited<ReturnType<typeof db.product.create>>;
let store: Awaited<ReturnType<typeof db.store.create>>;
const categoryId = `${tag}-category`;
const origin = new URL(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3100").origin;
function report(reason: unknown, extra: Record<string, unknown> = {}, requestOrigin = origin) {
  return POST(new Request(`${origin}/api/reports`, { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify({ productId: product.id, reason, ...extra }) }), { params: Promise.resolve({ path: ["reports"] }) });
}
async function clearLimits() {
  const ids = [customer?.id, admin?.id].filter(Boolean);
  if (ids.length) await db.rateLimit.deleteMany({ where: { OR: ids.flatMap((id) => [{ key: { startsWith: `${id}:` } }, { key: { startsWith: `report:${id}:` } }]) } });
}
describe("problem reports through the real API and isolated PostgreSQL", () => {
  beforeAll(async () => {
    customer = await db.user.create({ data: { name: tag } });
    admin = await db.user.create({ data: { name: `${tag}-admin`, role: "ADMIN" } });
    store = await db.store.create({ data: { name: tag, slug: tag, ownerId: customer.id } });
    await db.productCategory.create({ data: { id: categoryId, name: tag } });
    product = await db.product.create({ data: { name: tag, storeId: store.id, categoryId, imageUrl: "/images/rice.jpg", price: 1000 } });
  });
  beforeEach(async () => { session.userId = customer.id; await clearLimits(); });
  afterAll(async () => {
    await clearLimits();
    if (product) await db.product.delete({ where: { id: product.id } });
    if (store) await db.store.delete({ where: { id: store.id } });
    await db.productCategory.deleteMany({ where: { id: categoryId } });
    await db.user.deleteMany({ where: { id: { in: [customer?.id, admin?.id].filter(Boolean) } } });
  });
  it.each(["ก", "เน่า", "เสีย", "เหม็น", "ไม่ดี", "ของหมด", "ร้านปิด", "ราคาไม่ตรง", "สินค้ามีกลิ่นผิดปกติ กรุณาตรวจสอบ", "ก".repeat(2000)])("accepts and persists a nonempty report (%s)", async (reason) => {
    const response = await report(`  ${reason}  `);
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data).toMatchObject({ productId: product.id, reason, status: "OPEN" });
    expect(await db.report.findUnique({ where: { id: data.id } })).toMatchObject({ reason, productId: product.id });
  });
  it.each(["", "   \n\t", null, 3, undefined])("rejects empty/malformed reasons with a Thai message, no internal field path (%s)", async (reason) => {
    const count = await db.report.count({ where: { productId: product.id } });
    const response = await report(reason);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { message: "กรุณาระบุปัญหาที่พบ" } });
    expect(await db.report.count({ where: { productId: product.id } })).toBe(count);
  });
  it("retains a 2000-character maximum without leaking technical schema errors", async () => {
    const response = await report("ก".repeat(2001));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { message: "รายละเอียดปัญหาต้องไม่เกิน 2,000 ตัวอักษร" } });
  });
  it("keeps authentication, origin and report rate limits enforced", async () => {
    session.userId = "";
    expect((await report("ก")).status).toBe(401);
    session.userId = customer.id;
    expect((await report("ก", {}, "https://foreign.invalid")).status).toBe(403);
    for (let i = 0; i < 5; i++) expect((await report("ก")).status).toBe(201);
    expect((await report("ก")).status).toBe(429);
  });
  it("shows the persisted short report in both the admin API and real admin dashboard", async () => {
    const response = await report("เน่า");
    expect(response.status).toBe(201);
    const { data: saved } = await response.json();
    const path = { params: Promise.resolve({ path: ["admin", "reports"] }) };
    expect((await GET(new Request(`${origin}/api/admin/reports`), path)).status).toBe(403);
    session.userId = admin.id;
    const visible = await GET(new Request(`${origin}/api/admin/reports`), path);
    expect(visible.status).toBe(200);
    expect((await visible.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: saved.id, reason: "เน่า" })]));
    const html = renderToStaticMarkup(await Reports());
    expect(html).toContain("เน่า");
    expect(html).toContain(product.name);
  });
});
