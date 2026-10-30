"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { MarketMapSurface } from "@/components/market-map-canvas";
import { normalizedPoint, zoneLabels } from "@/lib/market-map";
import {
  Plus,
  Save,
  Undo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Trash2,
  Pencil,
  ImageIcon,
} from "lucide-react";
import { ImageUpload } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canvasPoint, movePoint, type LayoutPoint } from "@/lib/layout-editor";
import styles from "./layout-editor.module.css";
type Zone = { id: string; name: string };
type Stall = LayoutPoint & {
  id: string;
  code: string;
  zoneId: string;
  directions: string;
  active: boolean;
};
type Deletion = {
  kind: "zone" | "stall";
  id: string;
  name: string;
  canDelete: boolean;
  blockers: string[];
};
async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(json?.error?.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
  return json.data;
}
export function LayoutEditor({
  marketId,
  image,
  zones: initialZones,
  stalls: initialStalls,
}: {
  marketId: string;
  image: string | null;
  zones: Zone[];
  stalls: Stall[];
}) {
  const [zones, setZones] = useState(initialZones),
    [stalls, setStalls] = useState(initialStalls);
  const [baseline, setBaseline] = useState(initialStalls),
    [history, setHistory] = useState<Stall[][]>([]);
  const [selected, setSelected] = useState(""),
    [adding, setAdding] = useState(false),
    [point, setPoint] = useState<LayoutPoint>({ x: 0.2, y: 0.25 });
  const [zoom, setZoom] = useState(1),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<
      "zone" | "batch" | "image" | "remove-image" | "reset" | null
    >(null),
    [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [imageValue, setImageValue] = useState(image),
    [savedImage, setSavedImage] = useState(image),
    [neutral, setNeutral] = useState(false);
  const canvas = useRef<HTMLDivElement>(null),
    drag = useRef<string | null>(null),
    lock = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  function openDialog(value: typeof dialog) {
    if (!dialog)
      returnFocus.current = document.activeElement as HTMLElement | null;
    setDialog(value);
  }
  function restoreFocus(event: Event) {
    if (returnFocus.current?.isConnected) {
      event.preventDefault();
      returnFocus.current.focus();
    }
  }
  const active = stalls.find((stall) => stall.id === selected);
  const changed = stalls.filter((stall) => {
    const old = baseline.find((row) => row.id === stall.id);
    return old && (old.x !== stall.x || old.y !== stall.y);
  });
  const dirty = changed.length > 0 || imageValue !== savedImage;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a[href]");
      if (
        anchor &&
        !anchor.getAttribute("href")?.startsWith("#") &&
        !window.confirm("มีตำแหน่งหรือภาพที่ยังไม่บันทึก ต้องการออกจากหน้านี้?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  function remember() {
    setHistory((rows) => [
      ...rows.slice(-19),
      stalls.map((row) => ({ ...row })),
    ]);
  }
  function move(id: string, next: LayoutPoint) {
    setStalls((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...next } : row)),
    );
  }
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function savePositions() {
    await run(async () => {
      const positions = changed.map(({ id, x, y }) => ({ id, x, y }));
      await request(`/api/admin/markets/${marketId}/layout`, "POST", {
        positions,
        expectedPositions: positions.map((p) => {
          const old = baseline.find((row) => row.id === p.id)!;
          return { id: p.id, x: old.x, y: old.y };
        }),
      });
      setBaseline(stalls.map((row) => ({ ...row })));
      setHistory([]);
      setMessage(`บันทึกตำแหน่ง ${positions.length} ล็อกแล้ว`);
    });
  }
  function select(id: string) {
    setSelected(id);
    setAdding(false);
  }
  function fieldValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return new FormData(event.currentTarget);
  }
  async function saveStall(event: FormEvent<HTMLFormElement>) {
    const form = fieldValues(event),
      coordinates = adding ? point : active!;
    await run(async () => {
      const data = {
        zoneId: String(form.get("zoneId")),
        code: String(form.get("code")),
        directions: String(form.get("directions")),
        active: form.get("active") === "on",
        ...(adding ? coordinates : {}),
      };
      const row: Stall = await request(
        adding
          ? `/api/admin/markets/${marketId}/stalls`
          : `/api/admin/stalls/${selected}`,
        adding ? "POST" : "PATCH",
        data,
      );
      setStalls((rows) =>
        adding
          ? [...rows, row]
          : rows.map((old) =>
              old.id === row.id ? { ...row, x: old.x, y: old.y } : old,
            ),
      );
      setBaseline((rows) =>
        adding
          ? [...rows, row]
          : rows.map((old) =>
              old.id === row.id ? { ...row, x: old.x, y: old.y } : old,
            ),
      );
      setSelected(row.id);
      setAdding(false);
      setHistory([]);
      setMessage("บันทึกข้อมูลล็อกแล้ว");
    });
  }
  async function openDeletion(kind: "zone" | "stall", id: string) {
    returnFocus.current = document.activeElement as HTMLElement | null;
    await run(async () => {
      const preview = await request(
        `/api/admin/${kind === "zone" ? "zones" : "stalls"}/${id}/deletion`,
        "GET",
      );
      setDeletion(preview);
      });
  }
  const zoomedWidth = `${zoom * 100}%`;
  return (
    <div className={styles.editor} aria-busy={busy}>
      <div className={styles.toolbar}>
        <Button
          type="button"
          variant={adding ? "default" : "outline"}
          disabled={busy || !zones.length}
          aria-pressed={adding}
          onClick={() => {
            setAdding(!adding);
            setSelected("");
          }}
        >
          <Plus data-icon="inline-start" />
          เพิ่มล็อก
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setEditingZone(null);
            openDialog("zone");
          }}
        >
          เพิ่มโซน
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !zones.length}
          onClick={() => openDialog("batch")}
        >
          เพิ่มหลายล็อก
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => openDialog("image")}
        >
          <ImageIcon data-icon="inline-start" />
          ภาพพื้นหลัง
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !history.length}
          onClick={() => {
            setStalls(history[history.length - 1]);
            setHistory((rows) => rows.slice(0, -1));
          }}
        >
          <Undo2 data-icon="inline-start" />
          ย้อนกลับ
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !dirty}
          onClick={() => openDialog("reset")}
        >
          <RotateCcw data-icon="inline-start" />
          คืนค่า
        </Button>
        <Button
          type="button"
          disabled={busy || !changed.length}
          onClick={() => void savePositions()}
        >
          <Save data-icon="inline-start" />
          {busy
            ? "กำลังบันทึก…"
            : `บันทึกตำแหน่ง${changed.length ? ` (${changed.length})` : ""}`}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className={styles.status} role="status">
        {message ||
          (dirty
            ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก"
            : "ตำแหน่งทั้งหมดบันทึกแล้ว")}
      </p>
      <div className={styles.workspace}>
        <section className={styles.board} aria-label="พื้นที่จัดวางล็อก">
          <div className={styles.viewport}>
            <div
              className={styles.stage}
              style={
                {
                  width: zoomedWidth,
                  "--editor-zoom": zoom,
                } as CSSProperties
              }
            >
              <MarketMapSurface
                name="ที่ผู้ดูแลอัปโหลด"
                layoutImage={neutral ? null : imageValue}
                ref={canvas}
                className={styles.canvas}
                role="group"
                aria-label="ผังวางตำแหน่ง"
                data-layout-canvas
                onClick={(event) => {
                  if (!adding || !canvas.current) return;
                  setPoint(
                    canvasPoint(
                      event.clientX,
                      event.clientY,
                      canvas.current.getBoundingClientRect(),
                    ),
                  );
                }}
              >
                {zoneLabels(stalls.map((stall) => ({ ...stall, zone: zones.find((zone) => zone.id === stall.zoneId)?.name ?? "" }))).map((zone) => (
                  <span key={zone.name} className={styles.zone} style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%` }}>โซน {zone.name}</span>
                ))}
                {stalls.map((stall) => (
                  <button
                    key={stall.id}
                    type="button"
                    className={styles.marker}
                    data-inactive={!stall.active}
                    disabled={busy}
                    aria-pressed={selected === stall.id}
                    aria-label={`ล็อก ${stall.code}${stall.active ? "" : " ปิดใช้งาน"} เลือกหรือใช้ปุ่มลูกศรเพื่อย้าย`}
                    style={{
                      left: `${normalizedPoint(stall).x * 100}%`,
                      top: `${normalizedPoint(stall).y * 100}%`,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      select(stall.id);
                    }}
                    onPointerDown={(event) => {
                      if (busy) return;
                      event.stopPropagation();
                      select(stall.id);
                      remember();
                      drag.current = stall.id;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (drag.current !== stall.id || !canvas.current) return;
                      move(
                        stall.id,
                        canvasPoint(
                          event.clientX,
                          event.clientY,
                          canvas.current.getBoundingClientRect(),
                        ),
                      );
                    }}
                    onPointerUp={(event) => {
                      drag.current = null;
                      if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onKeyDown={(event) => {
                      if (!event.key.startsWith("Arrow")) return;
                      event.preventDefault();
                      remember();
                      select(stall.id);
                      move(
                        stall.id,
                        movePoint(stall, event.key, event.shiftKey),
                      );
                    }}
                  >
                    {stall.code}
                  </button>
                ))}
                {adding && (
                  <span
                    className={styles.marker}
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                      pointerEvents: "none",
                    }}
                  >
                    ใหม่
                  </span>
                )}
                <span className={styles.entrance}>
                  ผังตำแหน่ง · ไม่ใช่พิกัดภูมิศาสตร์
                </span>
              </MarketMapSurface>
            </div>
          </div>
          <footer className={styles.footer}>
            <span>
              {adding
                ? "คลิกพื้นที่ว่างเพื่อวางล็อกใหม่"
                : "เลื่อนผังเพื่อดูพื้นที่ทั้งหมด · เลือกล็อกแล้วลาก หรือใช้ลูกศร (Shift เพื่อขยับเร็ว)"}
            </span>
            <div className={styles.inline}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="ย่อผัง"
                disabled={zoom <= 1}
                onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              >
                <ZoomOut />
              </Button>
              <span>{Math.round(zoom * 100)}%</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="ขยายผัง"
                disabled={zoom >= 2}
                onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
              >
                <ZoomIn />
              </Button>
            </div>
          </footer>
        </section>
        <aside className={styles.sidebar} aria-label="รายละเอียดโซนและล็อก">
          <h2>
            {adding
              ? "เพิ่มล็อกใหม่"
              : active
                ? `ล็อก ${active.code}`
                : "จัดวางพื้นที่ขาย"}
          </h2>
          {adding || active ? (
            <form
              key={`${adding ? "new" : active!.id}:${active?.code ?? ""}:${active?.zoneId ?? ""}:${active?.active ?? true}:${active?.directions ?? ""}`}
              onSubmit={saveStall}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="stall-zone">โซน</FieldLabel>
                  <select
                    id="stall-zone"
                    name="zoneId"
                    required
                    defaultValue={active?.zoneId ?? zones[0]?.id}
                    disabled={busy}
                  >
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="stall-code">รหัสล็อก</FieldLabel>
                  <Input
                    id="stall-code"
                    name="code"
                    maxLength={20}
                    required
                    defaultValue={active?.code ?? ""}
                    disabled={busy}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stall-directions">จุดสังเกต</FieldLabel>
                  <Input
                    id="stall-directions"
                    name="directions"
                    maxLength={1000}
                    defaultValue={active?.directions ?? ""}
                    disabled={busy}
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={active?.active ?? true}
                      disabled={busy}
                    />{" "}
                    เปิดใช้งานล็อก
                  </FieldLabel>
                </Field>
                <Button type="submit" disabled={busy}>
                  {adding ? "สร้างล็อกที่ตำแหน่งนี้" : "บันทึกข้อมูลล็อก"}
                </Button>
                {!adding && active && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void openDeletion("stall", active.id)}
                  >
                    <Trash2 data-icon="inline-start" />
                    ลบล็อก
                  </Button>
                )}
              </FieldGroup>
              <details className={styles.section}>
                <summary>ตำแหน่งขั้นสูง</summary>
                <FieldDescription>
                  สัดส่วนบนผัง 0–1 เปลี่ยนแล้วกดบันทึกตำแหน่ง
                </FieldDescription>
                {(["x", "y"] as const).map((axis) => (
                  <Field key={axis}>
                    <FieldLabel htmlFor={`coordinate-${axis}`}>
                      {axis.toUpperCase()}
                    </FieldLabel>
                    <Input
                      id={`coordinate-${axis}`}
                      type="number"
                      min={0}
                      max={1}
                      step="any"
                      value={adding ? point[axis] : active![axis]}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isFinite(value) || value < 0 || value > 1)
                          return;
                        if (adding)
                          setPoint((old) => ({ ...old, [axis]: value }));
                        else {
                          remember();
                          move(active!.id, { ...active!, [axis]: value });
                        }
                      }}
                    />
                  </Field>
                ))}
              </details>
            </form>
          ) : (
            <p className="help-text">
              เลือกล็อกบนผังเพื่อแก้ไข หรือเพิ่มโซนและเริ่มวางล็อกใหม่
            </p>
          )}
          <section className={styles.section}>
            <h3>โซน ({zones.length})</h3>
            <p className="help-text">
              ป้ายโซนวางตามกลุ่มล็อก ไม่มีการบันทึกขอบเขตโซน
            </p>
            {zones.map((zone) => (
              <div key={zone.id} className={styles.zoneRow}>
                <span>
                  {zone.name} ·{" "}
                  {stalls.filter((stall) => stall.zoneId === zone.id).length}{" "}
                  ล็อก
                </span>
                <div className={styles.inline}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`แก้ไขโซน ${zone.name}`}
                    onClick={() => {
                      setEditingZone(zone);
                      openDialog("zone");
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบโซน ${zone.name}`}
                    disabled={busy}
                    onClick={() => void openDeletion("zone", zone.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </section>
          <section className={styles.section}>
            <h3>ล็อกทั้งหมด ({stalls.length})</h3>
            <div className={styles.list}>
              {stalls.map((stall) => (
                <Button
                  key={stall.id}
                  type="button"
                  variant={selected === stall.id ? "secondary" : "ghost"}
                  aria-pressed={selected === stall.id}
                  onClick={() => select(stall.id)}
                >
                  {stall.code}
                  <span>
                    {zones.find((zone) => zone.id === stall.zoneId)?.name}
                    {stall.active ? "" : " · ปิด"}
                  </span>
                </Button>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy && !uploading) setDialog(null);
        }}
      >
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>
              {dialog === "zone"
                ? editingZone
                  ? "แก้ไขโซน"
                  : "เพิ่มโซน"
                : dialog === "batch"
                  ? "เพิ่มชุดล็อก"
                  : dialog === "reset"
                    ? "คืนค่าที่ยังไม่บันทึก"
                    : dialog === "remove-image"
                      ? "เอาภาพออกจากผังตลาด?"
                      : "ภาพพื้นหลังผังตลาด"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "image"
                ? "ใช้ผังเปล่าเพื่อจัดวางได้โดยไม่ลบภาพเดิม ภาพจะเปลี่ยนเมื่อคุณกดบันทึกเท่านั้น"
                : dialog === "remove-image"
                  ? "ยกเลิกการเชื่อมภาพกับตลาดเท่านั้น ไม่ลบไฟล์ที่อัปโหลด"
                  : dialog === "batch"
                    ? "เพิ่มสูงสุด 50 ล็อกพร้อมกัน หากมีรหัสซ้ำจะไม่สร้างทั้งชุด"
                    : "ข้อมูลที่บันทึกแล้วและประวัติการขายจะไม่ถูกลบ"}
            </DialogDescription>
          </DialogHeader>
          {dialog === "zone" && (
            <form
              key={editingZone?.id ?? "new"}
              onSubmit={(event) => {
                const form = fieldValues(event);
                void run(async () => {
                  const row: Zone = await request(
                    editingZone
                      ? `/api/admin/zones/${editingZone.id}`
                      : `/api/admin/markets/${marketId}/zones`,
                    editingZone ? "PATCH" : "POST",
                    { name: String(form.get("name")) },
                  );
                  setZones((rows) =>
                    editingZone
                      ? rows.map((old) => (old.id === row.id ? row : old))
                      : [...rows, row],
                  );
                  setDialog(null);
                  setMessage("บันทึกโซนแล้ว");
                });
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="zone-name">ชื่อโซน</FieldLabel>
                  <Input
                    autoFocus
                    id="zone-name"
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={editingZone?.name ?? ""}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  บันทึกโซน
                </Button>
              </FieldGroup>
            </form>
          )}
          {dialog === "batch" && (
            <form
              onSubmit={(event) => {
                const form = fieldValues(event);
                void run(async () => {
                  const result: { stalls: Stall[] } = await request(
                    `/api/admin/markets/${marketId}/stalls/batch`,
                    "POST",
                    {
                      zoneId: String(form.get("zoneId")),
                      prefix: String(form.get("prefix")),
                      start: Number(form.get("start")),
                      count: Number(form.get("count")),
                      columns: Number(form.get("columns")),
                      ...point,
                    },
                  );
                  const latest = result.stalls;
                  setStalls((rows) => [
                    ...rows,
                    ...latest.filter(
                      (row) => !rows.some((old) => old.id === row.id),
                    ),
                  ]);
                  setBaseline((rows) => [
                    ...rows,
                    ...latest.filter(
                      (row) => !rows.some((old) => old.id === row.id),
                    ),
                  ]);
                  setHistory([]);
                  setDialog(null);
                  setMessage("สร้างชุดล็อกแล้ว");
                });
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="batch-zone">โซน</FieldLabel>
                  <select id="batch-zone" name="zoneId" required>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="batch-prefix">ตัวอักษรนำหน้า</FieldLabel>
                  <Input
                    id="batch-prefix"
                    name="prefix"
                    defaultValue="A"
                    required
                    maxLength={10}
                  />
                </Field>
                {[
                  { name: "start", label: "เริ่มเลขที่", value: 1, max: 9999 },
                  { name: "count", label: "จำนวนล็อก", value: 6, max: 50 },
                  { name: "columns", label: "จำนวนคอลัมน์", value: 3, max: 10 },
                ].map((field) => (
                  <Field key={field.name}>
                    <FieldLabel htmlFor={`batch-${field.name}`}>
                      {field.label}
                    </FieldLabel>
                    <Input
                      id={`batch-${field.name}`}
                      name={field.name}
                      type="number"
                      required
                      min={1}
                      max={field.max}
                      defaultValue={field.value}
                    />
                  </Field>
                ))}
                <FieldDescription>
                  เริ่มที่ตำแหน่งล็อกใหม่บนผัง
                  (คลิกเพิ่มล็อกเพื่อเลือกจุดเริ่มก่อน)
                </FieldDescription>
                <Button type="submit" disabled={busy}>
                  สร้างชุดล็อก
                </Button>
              </FieldGroup>
            </form>
          )}
          {dialog === "image" && (
            <div className={styles.imageControls}>
              <Field>
                <FieldLabel>
                  <input
                    type="checkbox"
                    checked={neutral}
                    onChange={(event) => setNeutral(event.target.checked)}
                  />{" "}
                  แสดงผังเปล่าเฉพาะหน้าจอนี้
                </FieldLabel>
              </Field>
              <ImageUpload
                id="market-layout-upload"
                value={imageValue ?? undefined}
                disabled={busy}
                onBusyChange={setUploading}
                onChange={(value) => {
                  if (!value && savedImage) {
                    openDialog("remove-image");
                    return;
                  }
                  setImageValue(value || null);
                  setNeutral(false);
                }}
              />
              <Button
                type="button"
                disabled={busy || uploading || imageValue === savedImage}
                onClick={() =>
                  void run(async () => {
                    await request(`/api/admin/markets/${marketId}`, "PATCH", {
                      layoutImage: imageValue,
                    });
                    setSavedImage(imageValue);
                    setMessage("บันทึกภาพพื้นหลังแล้ว");
                    setDialog(null);
                  })
                }
              >
                บันทึกภาพพื้นหลัง
              </Button>
              {savedImage && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || uploading}
                  onClick={() => openDialog("remove-image")}
                >
                  เอาภาพออกจากตลาด
                </Button>
              )}
            </div>
          )}
          {dialog === "remove-image" && (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request(`/api/admin/markets/${marketId}`, "PATCH", {
                    layoutImage: null,
                  });
                  setImageValue(null);
                  setSavedImage(null);
                  setDialog(null);
                  setMessage("ยกเลิกภาพพื้นหลังแล้ว ไฟล์เดิมยังเก็บไว้");
                })
              }
            >
              ยืนยันเอาภาพออกจากตลาด
            </Button>
          )}
          {dialog === "reset" && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setStalls(baseline.map((row) => ({ ...row })));
                setImageValue(savedImage);
                setHistory([]);
                setDialog(null);
                setMessage("คืนค่าตำแหน่งและภาพที่ยังไม่บันทึกแล้ว");
              }}
            >
              ยืนยันคืนค่า
            </Button>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deletion}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletion(null);
        }}
      >
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>
              ลบ{deletion?.kind === "zone" ? "โซน" : "ล็อก"} {deletion?.name}
            </DialogTitle>
            <DialogDescription>ลบรายการนี้และข้อมูลที่เกี่ยวข้องถาวร?</DialogDescription>
          </DialogHeader>
          <Button type="button" variant="destructive" disabled={busy || !deletion}
            onClick={() => void run(async () => {
              if (!deletion) return;
              await request(`/api/admin/${deletion.kind === "zone" ? "zones" : "stalls"}/${deletion.id}`, "DELETE", {confirmDelete:true});
              if (deletion.kind === "zone") setZones(rows => rows.filter(row => row.id !== deletion.id));
              setStalls(rows => rows.filter(row => deletion.kind === "zone" ? row.zoneId !== deletion.id : row.id !== deletion.id));
              setBaseline(rows => rows.filter(row => deletion.kind === "zone" ? row.zoneId !== deletion.id : row.id !== deletion.id));
              setHistory([]);setSelected("");setDeletion(null);setMessage("ลบแล้ว");
            })}>ยืนยันลบถาวร</Button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
