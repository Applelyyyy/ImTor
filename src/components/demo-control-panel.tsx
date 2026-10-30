"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PriceView, RealisticDemoConfig, RealisticDemoState } from "@/lib/contracts";
import { money } from "@/lib/utils";

const endpoint = "/api/admin/demo-realistic";
const pendingStages = new Set(["MEDIA", "DATA", "VALIDATE"]);
const defaults: RealisticDemoConfig = {
  seed: "campus-realistic-v1", idempotencyKey: "campus-realistic-v1",
  markets: 2, zones: 8, stalls: 80, stores: 30, products: 150, customers: 100, reservations: 250,
  historyDays: 21, futureDays: 14, visitorReservations: true, useImages: true,
};
const stages: Record<RealisticDemoState["stage"], string> = {
  MEDIA: "เตรียมและตรวจสอบภาพ", DATA: "สร้างข้อมูลในฐานข้อมูล", VALIDATE: "ตรวจสอบความสอดคล้อง",
  READY: "พร้อมใช้งาน", ERROR: "พบปัญหา", CLEANING: "กำลังล้างข้อมูล", REMOVED: "ล้างข้อมูลแล้ว",
};
async function api<T>(url: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || "ทำรายการไม่สำเร็จ กรุณาลองใหม่");
  return (result?.data ?? result) as T;
}
function isState(value: unknown): value is RealisticDemoState {
  return !!value && typeof value === "object" && "batchId" in value && "stage" in value && "message" in value;
}

export function DemoControlPanel({ enabled, initialBatches }: {
  enabled: boolean;
  initialBatches: { id: string; label: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [config, setConfig] = useState(defaults);
  const [batchId, setBatchId] = useState("");
  const [state, setState] = useState<RealisticDemoState | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [count, setCount] = useState(5);
  const [days, setDays] = useState(7);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [at, setAt] = useState("");
  const [confirmBatchId, setConfirmBatchId] = useState("");
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const selected = !!state && state.batchId === batchId;
  const active = selected && state.stage !== "REMOVED";

  async function perform(operation: (signal: AbortSignal) => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    controller.current = new AbortController();
    setBusy(true); setError(""); setResult("");
    try { await operation(controller.current.signal); }
    catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function advance(initial: RealisticDemoState, signal: AbortSignal) {
    let next = initial;
    let requests = 0;
    // Each request performs one durable stage. No unattached background worker or fabricated progress.
    while (pendingStages.has(next.stage) && !signal.aborted && requests++ < 256) {
      next = await api<RealisticDemoState>(endpoint, { action: "advance", batchId: next.batchId }, signal);
      setState(next);
    }
    if (requests >= 256 && pendingStages.has(next.stage)) setResult("พักการประมวลผล กดดำเนินการต่อเพื่ออ่านสถานะและทำขั้นตอนถัดไป");
    router.refresh();
  }
  const action = (name: string, params: Record<string, unknown> = {}) => perform(async (signal) => {
    const value = await api<unknown>(endpoint, { action: name, batchId, ...params }, signal);
    if (isState(value)) { setState(value); if (pendingStages.has(value.stage)) await advance(value, signal); }
    else { setResult(JSON.stringify(value, null, 2)); }
    router.refresh();
  });
  const numeric: { name: "markets" | "zones" | "stalls" | "stores" | "products" | "customers" | "reservations" | "historyDays" | "futureDays"; label: string; min: number; max: number }[] = [
    { name: "markets", label: "ตลาด", min: 1, max: 8 },
    { name: "zones", label: "โซนรวมทุกตลาด", min: 1, max: 64 },
    { name: "stalls", label: "ล็อกรวมทุกตลาด", min: 1, max: 500 },
    { name: "stores", label: "ร้านค้า", min: 1, max: 100 },
    { name: "products", label: "สินค้า", min: 1, max: 1000 },
    { name: "customers", label: "ลูกค้า", min: 1, max: 500 },
    { name: "reservations", label: "การจอง", min: 0, max: 3000 },
    { name: "historyDays", label: "วันย้อนหลัง", min: 1, max: 90 },
    { name: "futureDays", label: "วันล่วงหน้า", min: 1, max: 90 },
  ];
  return <div className="stack" aria-busy={busy}>
    {!enabled && <p role="note" className="content-panel">ยังไม่เปิดการเปลี่ยนชุดข้อมูล ต้องเปิด DEMO_MODE และ ENABLE_DEMO_GENERATOR ที่เซิร์ฟเวอร์ก่อน ดูสถานะชุดเดิมได้โดยไม่แก้ไขข้อมูล</p>}
    <section className="form-panel">
      <h2>ชุดข้อมูลที่ปรับขนาดได้</h2>
      <p className="help-text mb-5">ไม่มีการสร้างบัญชี Google หรือเซสชันให้ลูกค้า ข้อมูลจริงที่มีอยู่ไม่ถูกแก้ไข</p>
      <form onSubmit={(e) => { e.preventDefault(); void perform(async (signal) => { setPreview(await api(endpoint, { action: "preview", config }, signal)); }); }}>
        <fieldset disabled={busy || !enabled} className="space-y-5">
          <legend className="sr-only">กำหนดชุดข้อมูล</legend>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setConfig({ ...defaults, idempotencyKey: config.idempotencyKey, seed: config.seed })}>ครบชุด 30 ร้าน</Button>
            <Button type="button" variant="outline" onClick={() => setConfig({ ...defaults, markets: 1, zones: 4, stalls: 28, stores: 10, products: 50, customers: 30, reservations: 60, seed: config.seed, idempotencyKey: config.idempotencyKey })}>ชุดเล็ก 10 ร้าน</Button>
            <Button type="button" variant="outline" onClick={() => setConfig({ ...defaults, markets: 2, zones: 8, stalls: 120, stores: 50, products: 250, customers: 150, reservations: 500, seed: config.seed, idempotencyKey: config.idempotencyKey })}>ชุดใหญ่ 50 ร้าน</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {numeric.map((field) => <label key={field.name} className="flex flex-col gap-2" htmlFor={`demo-${field.name}`}>{field.label}
              <Input id={`demo-${field.name}`} type="number" required min={field.min} max={field.max} step={1} value={config[field.name]} onChange={(e) => setConfig({ ...config, [field.name]: Number(e.target.value) })} />
            </label>)}
            <label className="flex flex-col gap-2" htmlFor="demo-seed">Seed ของข้อมูล<Input id="demo-seed" required maxLength={96} value={config.seed} onChange={(e) => setConfig({ ...config, seed: e.target.value })} /></label>
            <label className="flex flex-col gap-2" htmlFor="demo-key">รหัสป้องกันสร้างชุดซ้ำ<Input id="demo-key" required pattern="[a-zA-Z0-9_-]{1,96}" maxLength={96} value={config.idempotencyKey} onChange={(e) => setConfig({ ...config, idempotencyKey: e.target.value })} /></label>
          </div>
          <p className="help-text">ใช้รหัสเดิมเพื่อกลับมาทำชุดเดิมต่อ เปลี่ยนรหัสนี้เมื่อต้องการสร้างชุดใหม่</p>
          <label className="flex items-start gap-3"><input type="checkbox" checked={config.visitorReservations} onChange={(e) => setConfig({ ...config, visitorReservations: e.target.checked })} />ให้ผู้เข้าสู่ระบบทดลองจอง โดยยอมรับว่าไม่มีการซื้อขายจริงก่อนทุกครั้ง</label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={config.useImages} onChange={(e) => setConfig({ ...config, useImages: e.target.checked })} />ใช้ภาพ AI ต้นฉบับที่ผู้ดูแลเตรียมไว้และตรวจสอบแล้ว</label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="outline">ตรวจแผนก่อนสร้าง (ไม่บันทึกข้อมูล)</Button>
            <Button type="button" onClick={(e) => { if (!e.currentTarget.form?.reportValidity()) return; void perform(async (signal) => {
              const created = await api<RealisticDemoState>(endpoint, { action: "create", config }, signal);
              setState(created); setBatchId(created.batchId); await advance(created, signal);
            }); }}>สร้างชุดและดำเนินการตามขั้นตอน</Button>
          </div>
        </fieldset>
      </form>
      {preview !== null && <details open className="mt-5"><summary>แผนจากเซิร์ฟเวอร์ · ยังไม่มีการบันทึก</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm">{JSON.stringify(preview, null, 2)}</pre></details>}
    </section>
    <section className="content-panel">
      <h2>สถานะชุดและการทำต่อ</h2>
      <p className="help-text mb-4">ประมวลผลทีละคำขอขณะเปิดหน้านี้ คำขอที่ส่งแล้วอาจทำงานจนเสร็จบนเซิร์ฟเวอร์ หากปิดหน้าหรือเครือข่ายขาด ให้โหลดชุดเดิมแล้วกดดำเนินการต่อ</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-2" htmlFor="demo-batch">เลือกชุดที่บันทึกไว้
          <select id="demo-batch" value={batchId} disabled={busy} onChange={(e) => { setBatchId(e.target.value); setState(null); setConfirmBatchId(""); setConfirmCleanup(false); }}>
            <option value="">เลือกชุดข้อมูล</option>
            {state && !initialBatches.some((b) => b.id === state.batchId) && <option value={state.batchId}>{state.batchId}</option>}
            {initialBatches.map((b) => <option key={b.id} value={b.id}>{b.label} · {b.id}</option>)}
          </select>
        </label>
        <Button variant="outline" disabled={busy || !batchId} onClick={() => void perform(async (signal) => { const loaded = await api<RealisticDemoState>(`${endpoint}?batchId=${encodeURIComponent(batchId)}`, undefined, signal); setState(loaded); })}>โหลดสถานะล่าสุด</Button>
        <Button disabled={busy || !enabled || !active || state?.stage === "READY"} onClick={() => void perform(async (signal) => {
          const fresh = await api<RealisticDemoState>(`${endpoint}?batchId=${encodeURIComponent(batchId)}`, undefined, signal);
          setState(fresh);
          if (fresh.stage === "ERROR") {
            const retried = await api<RealisticDemoState>(endpoint, { action: "advance", batchId }, signal);
            setState(retried); await advance(retried, signal);
          } else if (fresh.stage === "CLEANING") {
            setResult("ชุดนี้กำลังล้างข้อมูล โปรดยืนยันรหัสชุดและกดล้างชุดอีกครั้งเพื่อทำต่อ");
          } else { await advance(fresh, signal); }
        })}>ดำเนินการต่อ</Button>
      </div>
      {selected && <div className="mt-5 space-y-2" role="status" aria-live="polite">
        <h3>{stages[state.stage]}</h3><p>{state.message}</p>
        <p className="help-text break-all">ชุด {state.batchId} · อ้างอิงเวลา {state.asOf}</p>
        <p className="help-text">ไฟล์ภาพที่บันทึกใน manifest: {Object.keys(state.assets ?? {}).length} · การจองโดยผู้เยี่ยมชม: {state.config.visitorReservations ? "เปิดให้ทดลอง" : "ปิด"}</p>
        {state.error && <p className="form-error">{state.error}</p>}
      </div>}
    </section>
    <section className="form-panel">
      <h2>ปรับชุดข้อมูลที่เลือก</h2>
      <fieldset disabled={busy || !enabled || !active || state?.stage !== "READY"} className="mt-4 space-y-5">
        <legend className="sr-only">การทำงานกับชุดข้อมูล</legend>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2" htmlFor="demo-count">จำนวนที่จะเพิ่ม<Input id="demo-count" type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
          <Button variant="outline" onClick={() => void action("add-merchants", { count })}>เพิ่มร้านค้า</Button>
          <Button variant="outline" onClick={() => void action("add-products", { count })}>เพิ่มสินค้า</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2" htmlFor="demo-days">วันที่จะขยาย<Input id="demo-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
          <Button variant="outline" onClick={() => void action("history", { days })}>เพิ่มประวัติย้อนหลัง</Button>
          <Button variant="outline" onClick={() => void action("sessions", { days })}>ขยายรอบตลาดล่วงหน้า</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void action("validate")}>ตรวจสอบชุดนี้</Button>
          <Button variant="outline" onClick={() => void action("images")}>ประมวลผลและอัปโหลดภาพเดิมใหม่</Button>
        </div>
        <p className="help-text">ปุ่มภาพใช้ไฟล์ต้นฉบับ AI ที่เตรียมไว้ ไม่ใช่การสร้างภาพ AI ใหม่ และไม่เปลี่ยนภาพที่ยังใช้งานได้เมื่ออัปโหลดล้มเหลว</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2" htmlFor="demo-product">รหัสสินค้าในชุดนี้<Input id="demo-product" value={productId} onChange={(e) => setProductId(e.target.value)} /></label>
          <label className="flex flex-col gap-2" htmlFor="demo-at">เวลา (กรุงเทพฯ)<Input id="demo-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
          <label className="flex flex-col gap-2" htmlFor="demo-quantity">จำนวนจอง<Input id="demo-quantity" type="number" min={1} max={99} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={!productId || !at} onClick={() => void action("discount-scenario", { productId, at: new Date(`${at}+07:00`).toISOString() })}>ดูสถานการณ์ส่วนลดตามเวลา</Button>
          <Button variant="outline" disabled={!productId} onClick={() => void action("reservation-scenario", { productId, quantity })}>สร้างสถานการณ์จองเตรียมไว้</Button>
        </div>
        <p className="help-text">เป็นสถานการณ์ของชุดนี้เท่านั้น ไม่เปลี่ยนนาฬิกาเซิร์ฟเวอร์หรือสวมสิทธิ์ลูกค้าจริง</p>
      </fieldset>
    </section>
    <section className="content-panel">
      <h2>ล้างเฉพาะชุดที่เลือก</h2>
      <p className="mb-4">จะลบข้อมูลและภาพที่เป็นของชุดนี้ รวมการจองของผู้เยี่ยมชมที่ยังรอรับ แต่เก็บบัญชีผู้ใช้จริงไว้ ไม่ลบภาพหรือข้อมูลจริง</p>
      <label className="flex flex-col gap-2" htmlFor="demo-cleanup-id">พิมพ์รหัสชุดเพื่อยืนยัน<Input id="demo-cleanup-id" disabled={busy || !active} value={confirmBatchId} onChange={(e) => setConfirmBatchId(e.target.value)} autoComplete="off" /></label>
      <label className="my-4 flex items-start gap-3"><input type="checkbox" disabled={busy || !active} checked={confirmCleanup} onChange={(e) => setConfirmCleanup(e.target.checked)} />ยืนยันลบการจองของผู้เยี่ยมชมในชุดนี้ด้วย รวมรายการที่ยังรอรับ โดยเก็บบัญชีจริงไว้</label>
      <Button variant="destructive" disabled={busy || !enabled || !active || confirmBatchId !== batchId || !confirmCleanup} onClick={() => void action("cleanup", { confirmBatchId, acknowledgeVisitorReservations: true })}>ล้างชุด {batchId || "ที่เลือก"}</Button>
    </section>
    {busy && <p role="status">กำลังรอผลจากเซิร์ฟเวอร์… แสดงขั้นตอนที่บันทึกจริง ไม่มีเปอร์เซ็นต์</p>}
    {error && <p className="form-error" role="alert">{error} · โหลดสถานะล่าสุดก่อนลองทำต่อ</p>}
    {result && <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm" role="status">{result}</pre>}
  </div>;
}

export function DemoPricePreview({ productId }: { productId: string }) {
  const [at, setAt] = useState("");
  const [price, setPrice] = useState<PriceView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <details><summary className="cursor-pointer">ดูราคาตามเวลา</summary>
    <form className="mt-3 min-w-52 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setError(""); setPrice(null);
      try { const iso = new Date(`${at}+07:00`).toISOString(); setPrice(await api<PriceView>(`/api/products/${encodeURIComponent(productId)}/pricing?at=${encodeURIComponent(iso)}`)); }
      catch (e) { setError(e instanceof Error ? e.message : "ดูราคาไม่สำเร็จ"); } finally { setBusy(false); }
    }}>
      <label className="flex flex-col gap-2">เวลา (กรุงเทพฯ)<Input type="datetime-local" required value={at} onChange={(e) => setAt(e.target.value)} /></label>
      <Button variant="outline" size="sm" disabled={busy}>คำนวณราคา</Button>
      {price && <p role="status">ราคา {money(price.current)} จาก {money(price.original)} · ลด {price.discountPercent}%</p>}
      {error && <p role="alert">{error}</p>}
      <p className="help-text">จากกฎราคาจริง ไม่เปลี่ยนราคาหรือนาฬิการะบบ</p>
    </form>
  </details>;
}
