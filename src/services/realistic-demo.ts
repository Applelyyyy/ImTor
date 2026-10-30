import { createHash } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_SHOPS } from "@/data/demo-catalog";
import { demoStateKey, loadDemoState, parseDemoConfig, stateJson, type DemoConfig, type DemoState } from "@/services/demo-state";
import { generateSessions, localInstant, shiftCalendarDate } from "@/services/schedule";
import { PricingService } from "@/services/pricing";

export type DemoValidation = { batchId: string; valid: boolean; counts: Record<string, number>; checks: Record<string, boolean>; errors: string[] };
const TZ = "Asia/Bangkok";
const transactionOptions = { isolationLevel: "ReadCommitted" as const, timeout: 120_000, maxWait: 10_000 };
function gate(): void {
  invariant(process.env.ENABLE_DEMO_GENERATOR === "true" && process.env.DEMO_MODE === "true", "Realistic demo requires DEMO_MODE and ENABLE_DEMO_GENERATOR", 403);
}
async function requireAdmin(tx: Prisma.TransactionClient, actorId: string): Promise<void> {
  invariant(Boolean(actorId), "An operator identity is required", 403);
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, suspended: true } });
  invariant(actor?.role === "ADMIN" && !actor.suspended, "An active administrator is required", 403);
}
function seedNumber(seed: string): number { return Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16); }
async function lockedState(tx: Prisma.TransactionClient, batchId: string): Promise<DemoState> {
  const key = demoStateKey(batchId);
  await tx.$queryRaw`SELECT key FROM "SystemSetting" WHERE key=${key} FOR UPDATE`;
  const row = await tx.systemSetting.findUnique({ where: { key } });
  invariant(row, "Demo state not found", 404);
  const state = row.value as unknown as DemoState;
  invariant(state.batchId === batchId, "Invalid persisted demo state", 500);
  return state;
}
async function persist(tx: Prisma.TransactionClient, state: DemoState): Promise<DemoState> {
  await tx.systemSetting.update({ where: { key: demoStateKey(state.batchId) }, data: { value: stateJson(state) } });
  return state;
}
function stallDistribution(config: DemoConfig): number[] {
  const minimums = Array.from({ length: config.markets }, (_, market) => Math.max(Math.ceil((config.stores - market) / config.markets), Math.ceil((config.zones - market) / config.markets), 1));
  invariant(minimums.reduce((a, b) => a + b, 0) <= config.stalls, "Stall count is insufficient for stores and zones");
  if (config.markets === 1) return [config.stalls];
  if (config.markets === 2) {
    const small = Math.max(minimums[0], Math.min(config.stalls - minimums[1], Math.round(config.stalls * 0.35)));
    return [small, config.stalls - small];
  }
  const result = [...minimums];
  for (let i = result.reduce((a, b) => a + b, 0); i < config.stalls; i++) result[i % config.markets]++;
  return result;
}

/** Request-driven, transactionally leased stages. No detached background task. */
export class RealisticDemoService {
  static async create(input: unknown, actorId: string): Promise<DemoState> {
    gate();
    const config = parseDemoConfig(input);
    stallDistribution(config);
    const batchId = `realistic_${createHash("sha256").update(config.idempotencyKey).digest("hex").slice(0, 32)}`;
    return db.$transaction(async (tx) => {
      await requireAdmin(tx, actorId);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`realistic:${config.idempotencyKey}`},0))::text`;
      const existing = await tx.systemSetting.findUnique({ where: { key: demoStateKey(batchId) } });
      if (existing) {
        const state = existing.value as unknown as DemoState;
        invariant(JSON.stringify(parseDemoConfig(state.config)) === JSON.stringify(config), "Idempotency key already has different configuration", 409);
        invariant(state.stage !== "REMOVED", "This idempotency key belongs to a removed batch", 409);
        return state;
      }
      const asOf = new Date().toISOString();
      await tx.demoBatch.create({ data: { id: batchId, label: "FICTIONAL · ตลาดชุมชนวิทยาเขตสมมติ · Realistic v1" } });
      const state: DemoState = { batchId, config, asOf, stage: config.useImages ? "MEDIA" : "DATA", message: config.useImages ? "รอภาพสาธิตที่ตรวจสอบแล้ว" : "พร้อมสร้างข้อมูลตัวอย่าง", assets: {} };
      await tx.systemSetting.create({ data: { key: demoStateKey(batchId), value: stateJson(state) } });
      await tx.auditLog.create({ data: { id: `${batchId}:audit:create`, actorId, action: "REALISTIC_DEMO_CREATED", target: batchId, changes: { fictional: true, seed: config.seed } } });
      return state;
    }, transactionOptions);
  }

  static async metadata(batchId: string): Promise<DemoState | null> { return loadDemoState(batchId); }

  static async populate(batchId: string, actorId: string, assetUrls: Record<string, string>): Promise<DemoState> {
    gate();
    return db.$transaction(async (tx) => {
      await requireAdmin(tx, actorId);
      const state = await lockedState(tx, batchId);
      invariant(!["CLEANING", "REMOVED"].includes(state.stage), "Demo batch is being removed", 409);
      if (["VALIDATE", "READY"].includes(state.stage)) return state;
      invariant(await tx.demoBatch.findUnique({ where: { id: batchId } }), "Demo batch not found", 404);
      invariant(await tx.product.count({ where: { demoBatchId: batchId } }) === 0, "Refusing to overwrite a partial or foreign demo graph", 409);
      const c = parseDemoConfig(state.config), asOf = new Date(state.asOf), today = formatInTimeZone(asOf, TZ, "yyyy-MM-dd");
      const id = (kind: string, index: number | string) => `${batchId}:${kind}:${index}`;
      const image = (key: string): string => {
        if (!c.useImages) return "";
        const value = assetUrls[key];
        invariant(typeof value === "string" && value.length < 2048, `Missing demo image: ${key}`);
        let url: URL;
        try { url = new URL(value); } catch { throw new Error(`Invalid demo image URL: ${key}`); }
        invariant(url.protocol === "https:" && !url.username && !url.password, `Invalid demo image URL: ${key}`);
        return value;
      };
      const users = Array.from({ length: c.stores + c.customers }, (_, i) => ({ id: id("user", i), name: `[ตัวอย่าง] ${i < c.stores ? "เจ้าของร้านสมมติ" : "ลูกค้าสมมติ"} ${i + 1}`, email: `person-${i}@${batchId}.invalid`, suspended: true, demoBatchId: batchId, createdAt: localInstant(shiftCalendarDate(today, -c.historyDays), "00:00", TZ) }));
      await tx.user.createMany({ data: users });
      await tx.productCategory.createMany({ data: DEMO_CATEGORIES.map((category) => ({ id: id("category", category.key), name: `[ตัวอย่าง] ${category.name}`, food: category.food })) });
      const venueStalls: string[][] = [];
      type Session = { id: string; marketId: string; date: string; startsAt: Date; endsAt: Date; status: string; demoBatchId: string };
      const sessions: Session[][] = [];
      const distribution = stallDistribution(c);
      for (let m = 0; m < c.markets; m++) {
        const marketId = id("market", m);
        await tx.marketVenue.create({ data: { id: marketId, slug: `demo-${batchId}-${m}`, name: `[ตัวอย่าง] ${m === 0 ? "ตลาดลานเพื่อน (ตลาดเล็ก)" : m === 1 ? "ตลาดลานสร้างสรรค์ (ตลาดใหญ่)" : `ตลาดชุมชนสมมติ ${m + 1}`}`, type: m === 0 ? "SMALL" : "LARGE", description: "ตลาดและผังสมมติสำหรับสาธิต ไม่ใช่สถานที่จริง", address: "วิทยาเขตสมมติ · ไม่ใช่สถานที่จริง", entrance: "ทางเข้าในแผนผังจำลอง", timezone: TZ, demoBatchId: batchId } });
        const zones = Array.from({ length: Math.ceil((c.zones - m) / c.markets) }, (_, z) => ({ id: id(`zone-${m}`, z), marketId, name: `โซน ${String.fromCharCode(65 + z)}` }));
        await tx.marketZone.createMany({ data: zones });
        const stalls = Array.from({ length: distribution[m] }, (_, s) => ({ id: id(`stall-${m}`, s), marketId, zoneId: zones[s % zones.length].id, code: `${String.fromCharCode(65 + s % zones.length)}${String(Math.floor(s / zones.length) + 1).padStart(2, "0")}`, x: 0.08 + (s % 8) * 0.12, y: 0.1 + Math.floor(s / 8) * 0.8 / Math.max(1, Math.ceil(distribution[m] / 8) - 1), directions: "ตำแหน่งสมมติบนแผนผังตัวอย่างเท่านั้น" }));
        await tx.marketStall.createMany({ data: stalls });
        venueStalls.push(stalls.map((stall) => stall.id));
        const rules = (m === 0 ? [1, 3] : [2, 4, 5]).map((weekday, r) => ({ id: id(`rule-${m}`, r), marketId, weekday, opens: "16:00", closes: "21:00", intervalWeeks: weekday === 3 ? 2 : 1, anchorDate: "2026-01-05", active: true }));
        await tx.marketScheduleRule.createMany({ data: rules });
        // Explicit presentation sessions are honestly labeled; current day stays useful at any hour.
        const dates = new Set([shiftCalendarDate(today, -c.historyDays), today, shiftCalendarDate(today, 1)]);
        const exceptions = [...dates].map((date, e) => ({ id: id(`exception-${m}`, e), marketId, date, cancelled: false, opens: date === today ? "00:00" : "16:00", closes: date === today ? "23:59" : "21:00", reason: "รอบสาธิตสมมติ ไม่ใช่กำหนดการตลาดจริง" }));
        await tx.marketScheduleException.createMany({ data: exceptions });
        const fromDate = shiftCalendarDate(today, -c.historyDays);
        const generated = generateSessions({ timezone: TZ, rules, exceptions, from: localInstant(fromDate, "00:00", TZ), days: c.historyDays + c.futureDays + 1 }).filter((session) => session.date >= fromDate && session.date <= shiftCalendarDate(today, c.futureDays));
        const rows = generated.map((session, s) => ({ ...session, id: id(`session-${m}`, s), marketId, demoBatchId: batchId }));
        await tx.marketSession.createMany({ data: rows });
        sessions.push(rows);
      }
      const stores = Array.from({ length: c.stores }, (_, i) => {
        const shop = DEMO_SHOPS[i % DEMO_SHOPS.length];
        return { id: id("store", i), slug: `demo-${batchId}-${i}`, name: `[ตัวอย่าง] ${shop.name}${i >= DEMO_SHOPS.length ? ` ${Math.floor(i / DEMO_SHOPS.length) + 1}` : ""}`, description: `${shop.description} · ร้านสมมติ ไม่มีการซื้อขายหรือรับสินค้าจริง`, imageUrl: image(shop.imageKey), ownerId: users[i].id, kind: "MARKET", open: i % 11 !== 7, demoBatchId: batchId };
      });
      await tx.store.createMany({ data: stores });
      const attendanceRows: Prisma.StoreAttendanceCreateManyInput[] = [];
      const assignmentRows: Prisma.StallAssignmentCreateManyInput[] = [];
      for (let i = 0; i < stores.length; i++) {
        const m = i % c.markets, slot = Math.floor(i / c.markets);
        for (let s = 0; s < sessions[m].length; s++) {
          const session = sessions[m][s];
          const attendanceId = id(`attendance-${i}`, s);
          const status = session.date < today ? "CLOSED" : session.date === today ? stores[i].open ? "OPEN" : "CLOSED" : (i + s) % 7 === 0 ? "NOT_ATTENDING" : "SCHEDULED";
          attendanceRows.push({ id: attendanceId, storeId: stores[i].id, sessionId: session.id, status, authorized: true, expectedArrival: session.date === today ? "00:00" : "16:00", sellingUntil: session.date === today ? "23:59" : "21:00" });
          if (status !== "NOT_ATTENDING") assignmentRows.push({ id: id(`assignment-${i}`, s), attendanceId, stallId: venueStalls[m][(slot + s) % venueStalls[m].length], startsAt: session.startsAt, endsAt: session.endsAt, verified: true });
        }
        await tx.attendanceTemplate.create({ data: { id: id("template", i), storeId: stores[i].id, marketId: id("market", m), weekday: m === 0 ? 1 : 2, preferredCode: `${String.fromCharCode(65 + slot % Math.ceil((c.zones - m) / c.markets))}${String(Math.floor(slot / Math.ceil((c.zones - m) / c.markets)) + 1).padStart(2, "0")}` } });
      }
      await tx.storeAttendance.createMany({ data: attendanceRows });
      await tx.stallAssignment.createMany({ data: assignmentRows });
      const historyCount = Math.min(20, Math.floor(c.products * 2 / 15));
      let rescues = 0, discounted = 0;
      const rescueTarget = Math.min(20, Math.floor(c.products * 2 / 15));
      const discountTarget = Math.min(20, Math.floor(c.products * 2 / 15));
      const attendanceByKey = new Map(attendanceRows.map((row) => [`${row.storeId}|${row.sessionId}`, row]));
      const productRows = Array.from({ length: c.products }, (_, i) => {
        const storeIndex = i % stores.length, shop = DEMO_SHOPS[storeIndex % DEMO_SHOPS.length];
        const choices = DEMO_PRODUCTS.filter((product) => shop.categories.includes(product.category));
        const subject = choices[(Math.floor(i / stores.length) + seedNumber(`${c.seed}:${storeIndex}`)) % choices.length];
        const historical = i < historyCount, m = storeIndex % c.markets;
        const eligible = sessions[m].filter((session) => historical ? session.date < today : session.date === today || session.date > today && attendanceByKey.get(`${stores[storeIndex].id}|${session.id}`)?.status !== "NOT_ATTENDING");
        const session = historical ? eligible[i % eligible.length] : i % 5 === 4 && eligible.length > 1 ? eligible[1 + (i % (eligible.length - 1))] : eligible[0];
        const food = DEMO_CATEGORIES.find((category) => category.key === subject.category)!.food;
        let mode = "REGULAR";
        if (!historical && food && rescues < rescueTarget) { mode = "RESCUE"; rescues++; }
        else if (!historical && discounted < discountTarget) { mode = "DISCOUNT"; discounted++; }
        return { id: id("product", i), storeId: stores[storeIndex].id, sessionId: session.id, categoryId: id("category", subject.category), name: `[ตัวอย่าง] ${subject.name}`, description: `${subject.name} จาก${shop.name} · สินค้าและราคาเป็นข้อมูลสมมติ ไม่มีการซื้อขายจริง`, imageUrl: image(subject.key), price: subject.price + (seedNumber(`${c.seed}:${i}`) % 3) * 500, mode, published: !historical, archived: historical, reservable: true, stock: 0, pickupStart: session.startsAt, pickupEnd: session.endsAt, allergens: subject.allergens, storage: food ? "ข้อมูลสาธิต · เก็บในภาชนะปิดและรับภายในช่วงเวลาที่กำหนด" : "ข้อมูลสาธิต · เก็บในที่แห้ง หลีกเลี่ยงความชื้น", demoBatchId: batchId, createdAt: session.startsAt < asOf ? session.startsAt : asOf };
      });
      type Product = typeof productRows[number];
      const history = productRows.filter((product) => product.archived);
      const current = productRows.filter((product) => !product.archived && product.pickupStart <= asOf && product.pickupEnd > asOf);
      invariant(c.reservations === 0 || history.length + current.length > 0, "No eligible reservation windows at the anchored clock");
      const rules: Prisma.DiscountRuleCreateManyInput[] = productRows.filter((product) => product.mode !== "REGULAR").map((product, i) => ({ id: id("discount", i), productId: product.id, kind: product.mode === "RESCUE" ? "FINAL_PERCENT" : "PERCENT_OFF", value: product.mode === "RESCUE" ? 50 : 20 + (i % 3) * 5, startsAt: product.pickupStart, endsAt: product.pickupEnd, priority: 10, timezone: TZ }));
      const reservations: Prisma.ReservationCreateManyInput[] = [];
      const movements: Prisma.InventoryMovementCreateManyInput[] = [];
      const debits = new Map<string, number>();
      for (let r = 0; r < c.reservations; r++) {
        const pool: Product[] = r % 4 !== 3 && history.length ? history : current.length ? current : history;
        const product = pool[r % pool.length], isPast = product.archived;
        const elapsed = Math.max(0, asOf.getTime() - product.pickupStart.getTime());
        const createdAt = isPast ? new Date(product.pickupStart.getTime() + 30 * 60_000) : new Date(asOf.getTime() - Math.min(elapsed / 2, (5 + r % 30) * 60_000));
        let status = ["COMPLETED", "COMPLETED", "CANCELLED", "EXPIRED", "RESERVED"][r % 5];
        if (isPast && status === "RESERVED") status = "EXPIRED";
        const expiresAt = status === "EXPIRED" && !isPast ? new Date(createdAt.getTime() + (asOf.getTime() - createdAt.getTime()) / 2) : product.pickupEnd;
        const completedAt = status === "COMPLETED" ? new Date(Math.min(asOf.getTime(), createdAt.getTime() + 20 * 60_000)) : null;
        const quantity = 1 + (r % 7 === 0 ? 1 : 0);
        const reservationId = id("reservation", r);
        const price = PricingService.calculate(product.price, rules.filter((rule) => rule.productId === product.id), createdAt).current;
        reservations.push({ id: reservationId, userId: users[c.stores + r % c.customers].id, productId: product.id, quantity, unitPrice: price, originalPrice: product.price, productMode: product.mode, status, pickupCode: `DEMO-${batchId}-${r}`, expiresAt, completedAt, demoBatchId: batchId, createdAt });
        movements.push({ id: id("debit", r), productId: product.id, reservationId, delta: -quantity, reason: "DEMO_RESERVATION", createdAt });
        debits.set(product.id, (debits.get(product.id) ?? 0) + quantity);
        if (status === "CANCELLED" || status === "EXPIRED") movements.push({ id: id("return", r), productId: product.id, reservationId, delta: quantity, reason: status, createdAt: expiresAt < asOf ? expiresAt : new Date(Math.min(asOf.getTime(), createdAt.getTime() + 60_000)) });
      }
      for (let i = 0; i < productRows.length; i++) {
        const product = productRows[i], opening = (debits.get(product.id) ?? 0) + 2 + seedNumber(`${c.seed}:stock:${i}`) % 14;
        product.stock = opening + movements.filter((movement) => movement.productId === product.id).reduce((sum, movement) => sum + movement.delta, 0);
        movements.push({ id: id("opening", i), productId: product.id, delta: opening, reason: "DEMO_OPENING", createdAt: product.createdAt });
      }
      await tx.product.createMany({ data: productRows });
      if (rules.length) await tx.discountRule.createMany({ data: rules });
      if (reservations.length) await tx.reservation.createMany({ data: reservations });
      await tx.inventoryMovement.createMany({ data: movements });
      await tx.auditLog.create({ data: { id: id("audit", "populated"), actorId, action: "REALISTIC_DEMO_POPULATED", target: batchId, changes: { fictional: true, stores: c.stores, products: c.products, reservations: c.reservations, asOf: state.asOf } } });
      return persist(tx, { ...state, stage: "VALIDATE", message: "สร้างข้อมูลแล้ว รอตรวจสอบความสอดคล้อง", error: undefined });
    }, transactionOptions);
  }

  /** Validates stored rows, not prose or a stage flag. Leaves failed evidence inspectable. */
  static async validate(batchId: string): Promise<DemoValidation> {
    gate();
    return db.$transaction(async (tx) => {
      const state = await lockedState(tx, batchId);
      invariant(!["CLEANING", "REMOVED"].includes(state.stage), "Demo batch is being removed", 409);
      const c = parseDemoConfig(state.config), prefix = `${batchId}:`, clock = new Date(state.asOf);
      const [users, stores, products, reservations, venues, attendances] = await Promise.all([
        tx.user.findMany({ where: { demoBatchId: batchId }, include: { accounts: true, sessions: true } }),
        tx.store.findMany({ where: { demoBatchId: batchId }, include: { owner: true } }),
        tx.product.findMany({ where: { demoBatchId: batchId }, include: { discounts: true, movements: true, category: true, store: true, session: true } }),
        tx.reservation.findMany({ where: { demoBatchId: batchId }, include: { user: true, product: { include: { discounts: true } }, movements: true } }),
        tx.marketVenue.findMany({ where: { demoBatchId: batchId }, include: { zones: true, stalls: true, sessions: true, rules: true, exceptions: true } }),
        tx.storeAttendance.findMany({ where: { store: { demoBatchId: batchId } }, include: { store: true, session: true, assignment: { include: { stall: true } } } }),
      ]);
      const counts: Record<string, number> = {
        users: users.length, stores: stores.length, products: products.length, reservations: reservations.length,
        markets: venues.length, zones: venues.reduce((sum, venue) => sum + venue.zones.length, 0), stalls: venues.reduce((sum, venue) => sum + venue.stalls.length, 0),
        smallStalls: venues.filter((venue) => venue.type === "SMALL").reduce((sum, venue) => sum + venue.stalls.length, 0), largeStalls: venues.filter((venue) => venue.type === "LARGE").reduce((sum, venue) => sum + venue.stalls.length, 0),
        archivedProducts: products.filter((product) => product.archived).length, publicProducts: products.filter((product) => product.published && !product.archived).length,
        discountedProducts: products.filter((product) => product.mode !== "REGULAR").length, rescueProducts: products.filter((product) => product.mode === "RESCUE").length,
        attendances: attendances.length, sessions: venues.reduce((sum, venue) => sum + venue.sessions.length, 0), movements: products.reduce((sum, product) => sum + product.movements.length, 0),
      };
      const today = formatInTimeZone(clock, TZ, "yyyy-MM-dd"), firstDate = shiftCalendarDate(today, -c.historyDays), lastDate = shiftCalendarDate(today, c.futureDays);
      const checks: Record<string, boolean> = {
        configuredCounts: counts.users === c.stores + c.customers && counts.stores === c.stores && counts.products === c.products && counts.reservations >= c.reservations && counts.markets === c.markets && counts.zones === c.zones && counts.stalls === c.stalls,
        productVisibility: counts.archivedProducts === Math.min(20, Math.floor(c.products * 2 / 15)) && counts.publicProducts + counts.archivedProducts === c.products,
        syntheticIdentity: users.every((user) => user.suspended && user.email?.endsWith(".invalid") && !user.accounts.length && !user.sessions.length),
        ownership: users.every((row) => row.id.startsWith(prefix)) && stores.every((row) => row.id.startsWith(prefix) && row.owner.demoBatchId === batchId) && products.every((row) => row.id.startsWith(prefix) && row.store.demoBatchId === batchId && row.categoryId.startsWith(prefix) && row.session?.demoBatchId === batchId && [...row.discounts, ...row.movements].every((child) => child.id.startsWith(prefix))) && reservations.every((row) => row.id.startsWith(prefix) && row.product.demoBatchId === batchId),
        noRealGeolocation: venues.every((row) => row.latitude === null && row.longitude === null) && stores.every((row) => row.latitude === null && row.longitude === null),
        sessionRange: venues.every((venue) => venue.sessions.every((session) => session.id.startsWith(prefix) && session.date >= firstDate && session.date <= lastDate && session.endsAt > session.startsAt)),
        productSession: products.every((product) => product.session && product.pickupStart?.getTime() === product.session.startsAt.getTime() && product.pickupEnd?.getTime() === product.session.endsAt.getTime() && product.createdAt <= clock && (product.archived ? product.session.date < today && !product.published : product.session.date >= today) && attendances.some((attendance) => attendance.storeId === product.storeId && attendance.sessionId === product.sessionId && attendance.assignment)),
        categoryImageRelevance: products.every((product) => {
          const index = Number(product.storeId.split(":").at(-1));
          const shop = DEMO_SHOPS[index % DEMO_SHOPS.length];
          return shop.categories.some((category) => product.categoryId === `${prefix}category:${category}`) && (c.useImages ? product.imageUrl.startsWith("https://") : product.imageUrl === "");
        }),
        foodRescueOnly: products.every((product) => product.mode !== "RESCUE" || product.category.food),
        inventory: products.every((product) => product.stock !== null && product.stock >= 0 && product.stock === product.movements.reduce((sum, movement) => sum + movement.delta, 0) && product.movements.filter((movement) => movement.reason === "DEMO_OPENING" && movement.delta > 0).length === 1),
        historicalPricing: reservations.every((reservation) => reservation.unitPrice === PricingService.calculate(reservation.product.price, reservation.product.discounts, reservation.createdAt).current && reservation.originalPrice === reservation.product.price && reservation.productMode === reservation.product.mode),
        reservationChronology: reservations.every((reservation) => reservation.createdAt <= clock && reservation.createdAt >= reservation.product.createdAt && reservation.createdAt >= reservation.product.pickupStart! && reservation.createdAt < reservation.product.pickupEnd! && reservation.expiresAt <= reservation.product.pickupEnd! && reservation.expiresAt >= reservation.createdAt && (!reservation.completedAt || reservation.completedAt >= reservation.createdAt && reservation.completedAt <= clock && reservation.completedAt <= reservation.product.pickupEnd!) && (reservation.status !== "COMPLETED" || Boolean(reservation.completedAt)) && (reservation.status !== "RESERVED" || reservation.expiresAt > clock) && (reservation.status !== "EXPIRED" || reservation.expiresAt <= clock)),
        reservationMovements: reservations.every((reservation) => {
          const debits = reservation.movements.filter((movement) => movement.delta < 0).reduce((sum, movement) => sum - movement.delta, 0);
          const returned = reservation.movements.filter((movement) => movement.delta > 0).reduce((sum, movement) => sum + movement.delta, 0);
          return debits === reservation.quantity && returned === (["CANCELLED", "EXPIRED"].includes(reservation.status) ? reservation.quantity : 0) && reservation.movements.every((movement) => movement.id.startsWith(prefix) && movement.productId === reservation.productId && movement.createdAt >= reservation.createdAt);
        }),
        attendanceOwnership: attendances.every((row) => row.id.startsWith(prefix) && row.store.demoBatchId === batchId && row.session.demoBatchId === batchId && (!row.assignment || row.assignment.id.startsWith(prefix) && row.assignment.stall.marketId === row.session.marketId && row.assignment.startsAt.getTime() === row.session.startsAt.getTime() && row.assignment.endsAt.getTime() === row.session.endsAt.getTime())),
        stallConflicts: true,
        currentAndFutureAttendance: attendances.some((row) => row.session.date === today) && attendances.some((row) => row.session.date > today),
        batchGraphIds: venues.every((venue) => venue.id.startsWith(prefix) && [...venue.zones, ...venue.stalls, ...venue.rules, ...venue.exceptions].every((row) => row.id.startsWith(prefix))),
      };
      const assignments = attendances.flatMap((row) => row.assignment ? [row.assignment] : []);
      const byStall = new Map<string, typeof assignments>();
      for (const assignment of assignments) byStall.set(assignment.stallId, [...(byStall.get(assignment.stallId) ?? []), assignment]);
      checks.stallConflicts = [...byStall.values()].every((rows) => {
        rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        return rows.every((row, i) => i === 0 || rows[i - 1].endsAt <= row.startsAt);
      });
      const errors = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => `Demo validation failed: ${name}`);
      const result: DemoValidation = { batchId, valid: errors.length === 0, counts, checks, errors };
      await persist(tx, { ...state, stage: result.valid ? "READY" : "ERROR", message: result.valid ? "ตรวจสอบข้อมูลสาธิตผ่านแล้ว" : "พบข้อมูลสาธิตไม่สอดคล้อง", error: errors.length ? errors.join("; ") : undefined });
      return result;
    }, transactionOptions);
  }
}
