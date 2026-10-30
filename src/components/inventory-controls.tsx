"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ProductEditorState } from "@/components/merchant-product-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { ChangeFeedback } from "@/components/change-feedback";

type Operation = "add" | "remove" | "sold-out";
type Inventory = { available: number | null; reserved: number; completed: number };
type Attempt = { operation: Operation; quantity?: number; idempotencyKey: string };
export function InventoryControls({ productId, available, compact = false, onStateChange }: {
  productId: string; available: number | null; compact?: boolean; onStateChange?: (state: ProductEditorState) => void;
}) {
  const id = useId();
  const router = useRouter();
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(available !== null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ value: Inventory; baseline: number | null } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [soldOutConfirmation, setSoldOutConfirmation] = useState(false);
  const pending = useRef<Attempt | null>(null);
  const lock = useRef(false);
  const current = confirmed && confirmed.baseline === available ? confirmed.value.available : available;
  useEffect(() => {
    onStateChange?.({dirty: quantity !== "1" || soldOutConfirmation, busy: busy || refreshing || uncertain || loading});
  }, [quantity, soldOutConfirmation, busy, refreshing, uncertain, loading, onStateChange]);
  useEffect(() => {
    if (available === null) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(productId)}/inventory`, {signal: controller.signal});
        const result = await response.json().catch(() => null);
        const value = result?.data as Inventory | undefined;
        if (!response.ok || !value || typeof value.available !== "number" || typeof value.reserved !== "number" || typeof value.completed !== "number") throw new Error(result?.error?.message ?? "โหลดจำนวนสินค้าที่ตรวจสอบแล้วไม่สำเร็จ");
        if (!controller.signal.aborted) setConfirmed({value,baseline:available});
      } catch (cause) {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "โหลดจำนวนไม่สำเร็จ");}
      finally {if (!controller.signal.aborted) setLoading(false);}
    })();
    return () => controller.abort();
  }, [productId, available]);
  async function submit(operation: Operation, retry = false) {
    if (lock.current || refreshing || loading) return;
    if (!retry && pending.current) return;
    const amount = Number(quantity);
    if (operation !== "sold-out" && (!/^\d+$/.test(quantity) || amount < 1 || amount > 1_000_000)) { setError("ระบุจำนวนเต็ม 1–1,000,000 ชิ้น"); return; }
    const attempt = retry ? pending.current : { operation, ...(operation !== "sold-out" ? { quantity: amount } : {}), idempotencyKey: crypto.randomUUID() };
    if (!attempt) return;
    pending.current = attempt;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/inventory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(attempt) });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) pending.current = null;
        throw new Error(result?.error?.message ?? "ปรับจำนวนไม่สำเร็จ");
      }
      const inventory = result?.data as Inventory | undefined;
      if (!inventory || !(inventory.available === null || typeof inventory.available === "number") || typeof inventory.reserved !== "number" || typeof inventory.completed !== "number") throw new Error("ยังไม่ได้รับจำนวนที่ยืนยันจากเซิร์ฟเวอร์");
      pending.current = null; setUncertain(false); setConfirmed({ value: inventory, baseline: available }); setSoldOutConfirmation(false);
      toast.success("อัปเดตจำนวนสินค้าแล้ว", {id:`inventory:${productId}:${attempt.idempotencyKey}`});
      startRefresh(() => router.refresh());
    } catch (e) { setUncertain(!!pending.current); setError(e instanceof Error ? e.message : "การเชื่อมต่อขัดข้อง"); }
    finally { lock.current = false; setBusy(false); }
  }
  if (available === null) return <p className="help-text">แสดงสินค้าอย่างเดียว · ไม่ติดตามจำนวน</p>;
  return <section className={`inventory-control${compact ? " inventory-control-compact" : ""}`} aria-busy={busy || refreshing || loading} aria-label="จำนวนสินค้า">
    <p className="inventory-available">คงเหลือ <ChangeFeedback value={current}><strong>{current}</strong></ChangeFeedback> ชิ้น</p>
    {loading && <p className="help-text" role="status">กำลังตรวจสอบจำนวน…</p>}
    {confirmed && <p className="help-text">จองไว้ {confirmed.value.reserved} ชิ้น · รับสินค้าแล้ว {confirmed.value.completed} ชิ้น</p>}
    <div className="inventory-actions">
      <label className="sr-only" htmlFor={`${id}-quantity`}>จำนวนที่เพิ่มหรือลด</label>
      <Input id={`${id}-quantity`} type="number" inputMode="numeric" min={1} max={1_000_000} step={1} value={quantity} disabled={loading || busy || refreshing || uncertain} onChange={(e) => setQuantity(e.target.value)} />
      <Button variant="outline" size="sm" disabled={loading || busy || refreshing || uncertain} onClick={() => void submit("add")}>เพิ่มจำนวน</Button>
      <Button variant="outline" size="sm" disabled={loading || busy || refreshing || uncertain || current === 0} onClick={() => void submit("remove")}>ลดจำนวน</Button>
    </div>
    <Button className="mt-2" variant="ghost" size="sm" disabled={loading || busy || refreshing || uncertain || current === 0} onClick={() => setSoldOutConfirmation(true)}>หมดแล้ว</Button>
    {soldOutConfirmation && <Alert className="mt-3"><AlertTitle>ตั้งจำนวนที่พร้อมขายเป็น 0?</AlertTitle><AlertDescription>ไม่ยกเลิกรายการจองที่มีอยู่ และไม่เปลี่ยนยอดรับสินค้าแล้ว<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={loading || busy || refreshing || uncertain} onClick={() => void submit("sold-out")}>ยืนยันหมดแล้ว</Button><Button size="sm" variant="outline" onClick={() => setSoldOutConfirmation(false)}>กลับ</Button></div></AlertDescription></Alert>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {error && uncertain && <div className="mt-2 flex flex-col gap-2"><p className="help-text">ผลรายการยังไม่แน่นอน ลองรายการเดิมด้วยรหัสเดิมเพื่อป้องกันเพิ่มหรือลดซ้ำ</p><Button variant="outline" size="sm" disabled={loading || busy || refreshing} onClick={() => void submit(pending.current!.operation, true)}>ตรวจสอบและลองรายการเดิมอีกครั้ง</Button></div>}
  </section>;
}
