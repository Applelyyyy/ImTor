import "./guard";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { ReservationService } from "@/services/reservations";
import { AttendanceService } from "@/services/attendance";
import { randomUUID } from "node:crypto";
const tag = "test-" + randomUUID();
let user: Awaited<ReturnType<typeof db.user.create>>,
  other: typeof user,
  store: Awaited<ReturnType<typeof db.store.create>>,
  product: Awaited<ReturnType<typeof db.product.create>>,
  market: Awaited<ReturnType<typeof db.marketVenue.create>>,
  stall: Awaited<ReturnType<typeof db.marketStall.create>>,
  session: Awaited<ReturnType<typeof db.marketSession.create>>;
describe("PostgreSQL transaction integrity", () => {
  beforeAll(async () => {
    user = await db.user.create({
      data: { name: tag, email: tag + "@example.invalid" },
    });
    other = await db.user.create({
      data: { name: tag + "other", email: tag + "other@example.invalid" },
    });
    store = await db.store.create({
      data: {
        name: tag,
        slug: tag,
        ownerId: user.id,
        kind: "PERMANENT",
        open: true,
      },
    });
    await db.productCategory.upsert({
      where: { id: "test-drinks" },
      create: { id: "test-drinks", name: "Test drinks" },
      update: {},
    });
    product = await db.product.create({
      data: {
        storeId: store.id,
        name: tag,
        imageUrl: "/images/tea.jpg",
        categoryId: "test-drinks",
        price: 10000,
        reservable: true,
        stock: 1,
        pickupStart: new Date(Date.now() - 60000),
        pickupEnd: new Date(Date.now() + 3600000),
      },
    });
    market = await db.marketVenue.create({ data: { slug: tag, name: tag } });
    const zone = await db.marketZone.create({
      data: { marketId: market.id, name: "A" },
    });
    stall = await db.marketStall.create({
      data: {
        marketId: market.id,
        zoneId: zone.id,
        code: "A01",
        x: 0.2,
        y: 0.3,
      },
    });
    session = await db.marketSession.create({
      data: {
        marketId: market.id,
        date: "2099-01-01",
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 3600000),
      },
    });
  });
  afterAll(async () => {
    await db.inventoryMovement.deleteMany({
      where: { productId: product?.id },
    });
    await db.reservation.deleteMany({ where: { productId: product?.id } });
    await db.product.deleteMany({ where: { storeId: store?.id } });
    await db.store.deleteMany({
      where: { ownerId: { in: [user?.id, other?.id].filter(Boolean) } },
    });
    await db.marketVenue.deleteMany({ where: { id: market?.id } });
    await db.user.deleteMany({
      where: { id: { in: [user?.id, other?.id].filter(Boolean) } },
    });
    await db.auditLog.deleteMany({
      where: { actorId: { in: [user?.id, other?.id].filter(Boolean) } },
    });
    await db.productCategory.deleteMany({
      where: { id: "test-drinks", products: { none: {} } },
    });
    await db.$disconnect();
  });
  it("only one customer gets the final unit", async () => {
    const results = await Promise.allSettled([
      ReservationService.create(user, product.id, 1),
      ReservationService.create(other, product.id, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock,
    ).toBe(0);
    const reservation = await db.reservation.findFirstOrThrow({
      where: { productId: product.id },
    });
    await ReservationService.transition(
      reservation.userId === user.id ? user : other,
      reservation.id,
      "CANCELLED",
    );
    await expect(
      ReservationService.transition(user, reservation.id, "CANCELLED"),
    ).rejects.toThrow();
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock,
    ).toBe(1);
  });
  it("snapshots authoritative discount and requires pickup code", async () => {
    await db.discountRule.create({
      data: {
        productId: product.id,
        kind: "FINAL_PERCENT",
        value: 30,
        startsAt: new Date(Date.now() - 1000),
        endsAt: new Date(Date.now() + 3600000),
      },
    });
    await db.product.update({
      where: { id: product.id },
      data: { mode: "DISCOUNT" },
    });
    const reservation = await ReservationService.create(other, product.id, 1);
    expect(reservation.unitPrice).toBe(3000);
    expect((reservation as {productMode?:string}).productMode).toBe('DISCOUNT');
    await expect(
      ReservationService.transition(user, reservation.id, "COMPLETED", "wrong"),
    ).rejects.toThrow();
    await ReservationService.transition(
      user,
      reservation.id,
      "COMPLETED",
      reservation.pickupCode,
    );
    await expect(
      ReservationService.transition(
        user,
        reservation.id,
        "COMPLETED",
        reservation.pickupCode,
      ),
    ).rejects.toThrow();
  });
  it("denies another owner and overlapping confirmed stall claims", async () => {
    await expect(
      AttendanceService.save(other, {
        storeId: store.id,
        sessionId: session.id,
        stallId: stall.id,
        authorized: true,
        status: "SCHEDULED",
      }),
    ).rejects.toThrow();
    const second = await db.store.create({
      data: { name: tag + "2", slug: tag + "2", ownerId: other.id },
    });
    const claims = await Promise.allSettled([
      AttendanceService.save(user, {
        storeId: store.id,
        sessionId: session.id,
        stallId: stall.id,
        authorized: true,
        status: "SCHEDULED",
      }),
      AttendanceService.save(other, {
        storeId: second.id,
        sessionId: session.id,
        stallId: stall.id,
        authorized: true,
        status: "SCHEDULED",
      }),
    ]);
    expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("database rejects a negative stock update", async () => {
    await expect(
      db.product.update({ where: { id: product.id }, data: { stock: -1 } }),
    ).rejects.toThrow();
  });
it('releases expired inventory once and only once',async()=>{
 await db.product.update({where:{id:product.id},data:{stock:1}});
 const reservation=await ReservationService.create(other,product.id,1);
 await db.reservation.update({where:{id:reservation.id},data:{expiresAt:new Date(Date.now()-1000)}});
 await ReservationService.expire();await ReservationService.expire();
 expect((await db.reservation.findUniqueOrThrow({where:{id:reservation.id}})).status).toBe('EXPIRED');
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock).toBe(1);
});
});
