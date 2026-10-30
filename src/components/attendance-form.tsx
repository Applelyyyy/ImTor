"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import type { MarketView } from "@/lib/contracts";
import { ApiForm } from "@/components/forms";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export function AttendanceForm({ markets, storeId }: { markets: MarketView[]; storeId: string }) {
  const id = useId();
  const hydrated = useHydrated();
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [sessionId, setSessionId] = useState("");
  const [marketDetails, setMarketDetails] = useState<MarketView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const chosen = markets.find((m) => m.id === marketId);
  const sessions = chosen?.sessions.filter((s) => !["CANCELLED", "FINISHED", "CLOSED"].includes(s.status)) ?? [];
  async function chooseSession(value: string) {
    request.current?.abort(); setSessionId(value); setMarketDetails(null); setError(""); setBusy(false);
    if (!value || !chosen) return;
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try {
      const response = await fetch(`/api/markets/${encodeURIComponent(chosen.slug)}?session=${encodeURIComponent(value)}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok || !result?.data) throw new Error("โหลดล็อกไม่สำเร็จ ลองเลือกวันอีกครั้ง");
      if (!controller.signal.aborted) setMarketDetails(result.data);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "โหลดล็อกไม่สำเร็จ"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  if (!markets.length) return <p>ยังไม่มีตลาดเปิดให้ลงทะเบียน</p>;
  return <div className="merchant-attendance-picker" aria-busy={busy}>
    <FieldGroup>
      <Field><FieldLabel htmlFor={`${id}-market`}>1. ขายที่ตลาดไหน?</FieldLabel><select disabled={!hydrated} id={`${id}-market`} value={marketId} onChange={(e) => { request.current?.abort(); setMarketId(e.target.value); setSessionId(""); setMarketDetails(null); setBusy(false); setError(""); }}>{markets.map((m) => <option key={m.id} value={m.id}>{m.name}{m.demo ? " (สาธิต)" : ""}</option>)}</select></Field>
      <Field><FieldLabel htmlFor={`${id}-session`}>2. ขายวันไหน?</FieldLabel><select disabled={!hydrated} id={`${id}-session`} value={sessionId} onChange={(e) => void chooseSession(e.target.value)}><option value="">เลือกวันและเวลา</option>{sessions.map((s) => <option key={s.id} value={s.id}>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: chosen?.timezone }).format(new Date(s.startsAt))} · {new Intl.DateTimeFormat("th-TH", { timeStyle: "short", timeZone: chosen?.timezone }).format(new Date(s.startsAt))}–{new Intl.DateTimeFormat("th-TH", { timeStyle: "short", timeZone: chosen?.timezone }).format(new Date(s.endsAt))}</option>)}</select>{!sessions.length && <p className="help-text">ตลาดนี้ยังไม่มีรอบเปิดให้ลงทะเบียน</p>}</Field>
    </FieldGroup>
    {busy && <p className="help-text mt-4" role="status">กำลังดูล็อกในรอบที่เลือก…</p>}
    {error && <p className="form-error mt-4" role="alert">{error}</p>}
    {marketDetails && sessionId && <div className="mt-6"><ApiForm key={`${marketId}:${sessionId}`} endpoint="/api/attendance" body={{ storeId, sessionId }} fields={[
      { name: "stallId", label: "3. เลือกล็อกที่ได้รับอนุญาต", type: "select", required: true, options: marketDetails.stalls.filter((s) => s.active).map((s) => ({ value: s.id, label: `โซน ${s.zone} · ${s.code}${s.vendor ? ` · ${s.vendor.name} ลงทะเบียนอยู่` : ""}` })) },
      { name: "authorized", label: "ฉันมีสิทธิใช้พื้นที่นี้ การเลือกล็อกในอิ่มต่อไม่ใช่ใบอนุญาตจากตลาด", type: "checkbox", required: true },
    ]} submit="บันทึกวันและล็อก" /></div>}
  </div>;
}
