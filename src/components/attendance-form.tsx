"use client";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AttendanceSelectionView } from "@/lib/contracts";
import { attendanceSessionLabel, eligibleAttendanceSessions, stallSelectionState } from "@/lib/attendance-picker";
import { request, RequestError } from "@/lib/api-request";
import { AppDialog } from "@/components/app-dialog";
import { MarketMapCanvas } from "@/components/market-map-canvas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import styles from "./attendance-form.module.css";

type FormState = { dirty: boolean; busy: boolean };
type PickerProps = { storeId: string; initialMarketId?: string; initialSessionId?: string };

export function AttendancePicker({ label = "เลือกตลาดและล็อก", ...props }: PickerProps & { label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>({ dirty: false, busy: false });
  const opener = useRef<HTMLButtonElement>(null);
  const onStateChange = useCallback((next: FormState) => setState(next), []);
  return <>
    <Button ref={opener} variant="outline" onClick={() => setOpen(true)}>{label}</Button>
    <AppDialog open={open} onOpenChange={setOpen} title="วันนี้ขายที่ไหน?" description="เลือกตลาดและแตะล็อกของคุณบนแผนผัง" wide {...state} restoreFocusRef={opener}>
      {open && <AttendanceForm {...props} onStateChange={onStateChange} onSaved={() => setOpen(false)} />}
    </AppDialog>
  </>;
}

export function AttendanceForm({ storeId, initialMarketId, initialSessionId, onStateChange, onSaved }: PickerProps & { onStateChange?: (state: FormState) => void; onSaved?: () => void }) {
  const router = useRouter();
  const fieldId = useId();
  const panelId = `${fieldId}-panel`;
  const [data, setData] = useState<AttendanceSelectionView | null>(null);
  const [marketId, setMarketId] = useState(initialMarketId ?? "");
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [stallId, setStallId] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [showPanel, setShowPanel] = useState(false);
  const [filter, setFilter] = useState("");
  const lock = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);
  const abort = useRef<AbortController | null>(null);
  const market = data?.markets.find((row) => row.id === marketId);
  const sessions = market ? eligibleAttendanceSessions(market) : [];
  const session = sessions.find((row) => row.id === sessionId);
  const stall = market?.stalls.find((row) => row.id === stallId);
  const selection = stall && session ? stallSelectionState(stall, session) : null;
  const busy = saving || refreshing;
  const dirty = !!session && (authorized || (!!stallId && stallId !== session.currentAttendance?.stallId));
  useEffect(() => { onStateChange?.({ dirty, busy }); }, [dirty, busy, onStateChange]);

  const load = useCallback(async (preferredMarket?: string, preferredSession?: string, keepSelection = false) => {
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch(`/api/attendance/selection?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok || !result?.data || !Array.isArray(result.data.markets)) throw new Error();
      if (controller.signal.aborted) return;
      const next = result.data as AttendanceSelectionView;
      const chosenMarket = next.markets.find((row) => row.id === preferredMarket) ?? (keepSelection ? undefined : next.markets.find((row) => eligibleAttendanceSessions(row).length) ?? next.markets[0]);
      const options = chosenMarket ? eligibleAttendanceSessions(chosenMarket) : [];
      const chosenSession = options.find((row) => row.id === preferredSession) ?? (keepSelection && preferredSession ? undefined : options[0]);
      setError(""); setData(next); setMarketId(chosenMarket?.id ?? ""); setSessionId(chosenSession?.id ?? "");
      if (!keepSelection || !chosenSession) { setStallId(chosenSession?.currentAttendance?.stallId ?? ""); setShowPanel(false); setAuthorized(false); }
    } catch {
      if (!controller.signal.aborted) setError("โหลดแผนผังไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [storeId]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(initialMarketId, initialSessionId); });
    return () => { active = false; abort.current?.abort(); };
  }, [load, initialMarketId, initialSessionId]);

  function chooseMarket(value: string) {
    const nextMarket = data?.markets.find((row) => row.id === value);
    const nextSession = nextMarket ? eligibleAttendanceSessions(nextMarket)[0] : undefined;
    setMarketId(value); setSessionId(nextSession?.id ?? ""); setStallId(nextSession?.currentAttendance?.stallId ?? "");
    setShowPanel(false); setAuthorized(false); setError(""); setFilter("");
  }
  function chooseSession(value: string) {
    const next = sessions.find((row) => row.id === value);
    setSessionId(value); setStallId(next?.currentAttendance?.stallId ?? ""); setShowPanel(false); setAuthorized(false); setError("");
  }
  function select(id: string, element: HTMLButtonElement) {
    trigger.current = element; setStallId(id); setShowPanel(true); setAuthorized(false); setError("");
  }
  useEffect(() => { if (showPanel && window.matchMedia("(max-width:767px)").matches) panel.current?.focus({ preventScroll: true }); }, [showPanel, stallId]);
  function closePanel() { setShowPanel(false); trigger.current?.focus({ preventScroll: true }); }
  async function save() {
    if (lock.current || !session || !stall || !selection?.selectable || !authorized || !data?.registrationEnabled) return;
    lock.current = true; setSaving(true); setError("");
    try {
      await request("/api/attendance", "POST", { storeId, sessionId: session.id, stallId: stall.id, authorized: true, status: session.currentAttendance?.status === "OPEN" ? "OPEN" : "SCHEDULED" });
      setAuthorized(false); toast.success("บันทึกตำแหน่งเรียบร้อย", { id: `attendance:${storeId}` });
      await load(marketId, sessionId);
      startRefresh(() => router.refresh());
      onSaved?.();
    } catch (err) {
      const conflict = err instanceof RequestError && err.status === 409;
      const message = conflict ? (err.message.startsWith("ล็อก") ? "ล็อกนี้ถูกเลือกไปแล้ว กรุณาเลือกล็อกอื่น" : "รอบตลาดนี้ไม่เปิดให้เลือกล็อก") : "บันทึกตำแหน่งไม่สำเร็จ กรุณาลองอีกครั้ง";
      setError(message); toast.error(message, { id: `attendance:${storeId}` });
      if (conflict) { await load(marketId, sessionId, true); setAuthorized(false); setError(message); }
    } finally { lock.current = false; setSaving(false); }
  }

  if (loading && !data) return <p role="status">กำลังโหลดตลาดและแผนผัง…</p>;
  if (!data) return <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => { setLoading(true); void load(marketId, sessionId); }}>ลองอีกครั้ง</Button></div>;
  if (!data.markets.length) return <p role="status">ยังไม่มีตลาดเปิดให้ลงทะเบียน กรุณาติดต่อผู้ดูแลตลาด</p>;
  return <div className={styles.root} aria-busy={busy || loading} data-attendance-selector>
    {!data.registrationEnabled && <p role="status">การลงทะเบียนตลาดปิดชั่วคราว</p>}
    <fieldset className={styles.choices} disabled={busy || loading}>
      <legend>ตลาด</legend>
      <ToggleGroup type="single" value={marketId} onValueChange={(value) => { if (value) chooseMarket(value); }} variant="outline" className={styles.options} aria-label="เลือกตลาด">
        {data.markets.map((row) => <ToggleGroupItem key={row.id} value={row.id}>{row.name}</ToggleGroupItem>)}
      </ToggleGroup>
    </fieldset>
    <fieldset className={styles.choices} disabled={busy || loading}>
      <legend>วันและเวลา (กรุงเทพฯ)</legend>
      <ToggleGroup type="single" value={sessionId} onValueChange={(value) => { if (value) chooseSession(value); }} variant="outline" className={styles.dates} aria-label="เลือกรอบตลาด">
        {sessions.map((row) => <ToggleGroupItem key={row.id} value={row.id}>{attendanceSessionLabel(row)}{row.currentAttendance?.stallId ? " · ลงทะเบียนแล้ว" : ""}</ToggleGroupItem>)}
      </ToggleGroup>
      {!sessions.length && <p role="status">ตลาดนี้ยังไม่มีรอบเปิดให้เลือกล็อก</p>}
    </fieldset>
    {session && market && <div className={styles.workspace}>
      <div className={styles.map} aria-busy={busy}>
        <MarketMapCanvas key={market.id} name={market.name} layoutImage={market.layoutImage} entrance={market.entrance}
          stalls={market.stalls.map((row) => ({ ...row, status: stallSelectionState(row, session).status, detail: stallSelectionState(row, session).label }))}
          selectedId={stallId} onSelect={(id, element) => { if (!busy && !loading) select(id, element); }} disabled={busy || loading} controlsId={panelId} />
        <details className={styles.textList}>
          <summary>เลือกล็อกจากรายการข้อความ</summary>
          <Field className="mt-3"><FieldLabel htmlFor={`${fieldId}-search`}>ค้นหาโซนหรือรหัสล็อก</FieldLabel><Input id={`${fieldId}-search`} value={filter} onChange={(event) => setFilter(event.target.value)} /></Field>
          <ul>{market.stalls.filter((row) => `${row.code} ${row.zone}`.toLocaleLowerCase("th").includes(filter.trim().toLocaleLowerCase("th"))).map((row) => <li key={row.id}><Button variant="outline" disabled={busy || loading} aria-pressed={stallId === row.id} aria-controls={panelId} onClick={(event) => select(row.id, event.currentTarget)}>โซน {row.zone} · {row.code} · {stallSelectionState(row, session).label}</Button></li>)}</ul>
        </details>
        {!market.stalls.length && <p role="status">ยังไม่มีล็อกในตลาดนี้ กรุณาติดต่อผู้ดูแลตลาด</p>}
      </div>
      <section ref={panel} data-app-dialog-escape-layer={showPanel ? "" : undefined} tabIndex={-1} id={panelId} className={styles.panel} data-open={showPanel && !!stall || undefined} aria-labelledby={`${panelId}-title`}
        onKeyDown={(event) => { if (event.key === "Escape" && showPanel) { event.stopPropagation(); closePanel(); } }}>
        {stall && selection ? <>
          <div className={styles.panelHeader}><h2 id={`${panelId}-title`}>โซน {stall.zone} · ล็อก {stall.code}</h2><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={closePanel} className={styles.mobileClose}>กลับไปเลือก</Button></div>
          <p className={styles.status} role="status">{selection.label}</p>
          {selection.store && <p>{selection.store.name}</p>}
          {!selection.selectable && <p>{stall.active ? "ล็อกนี้มีร้านลงทะเบียนแล้ว กรุณาเลือกล็อกอื่น" : "ล็อกนี้ปิดใช้งาน กรุณาเลือกล็อกอื่น"}</p>}
          <p className="help-text">{selection.verified ? "ผู้ดูแลยืนยันตำแหน่งแล้ว" : (selection.own || (!selection.selectable && stall.active)) ? "ตำแหน่งที่ร้านแจ้งเอง ยังไม่ได้ยืนยันโดยผู้จัดตลาด" : "ยังไม่ยืนยันตำแหน่ง"}</p>
          {stall.directions && <p className="help-text">{stall.directions}</p>}
          {selection.selectable && <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <Field orientation="horizontal" className={styles.acknowledgement}>
              <Checkbox id={`${fieldId}-authorized`} checked={authorized} onCheckedChange={(value) => setAuthorized(value === true)} disabled={busy || loading || !data.registrationEnabled} required aria-describedby={`${fieldId}-permission-description`} />
              <div><FieldLabel htmlFor={`${fieldId}-authorized`}>ฉันยืนยันว่ามีสิทธิ์ใช้ล็อกนี้</FieldLabel><FieldDescription id={`${fieldId}-permission-description`} className="sr-only">ยืนยันสิทธิ์ใช้พื้นที่</FieldDescription></div>
            </Field>
            <Button type="submit" disabled={busy || loading || !authorized || !data.registrationEnabled} className={styles.confirm}>{busy ? "กำลังบันทึก…" : `ยืนยันล็อก ${stall.code}`}</Button>
          </form>}
        </> : <><h2 id={`${panelId}-title`}>แตะล็อกบนแผนผัง</h2><p className="help-text">ดูตำแหน่งแล้วเลือกล็อกที่คุณมีสิทธิ์ใช้</p></>}
      </section>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
