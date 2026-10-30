"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Map, CalendarDays, Pencil } from "lucide-react";
import { ApiButton, ApiForm, type FormField } from "@/components/forms";
import { AppDialog } from "@/components/app-dialog";
import { AdminTableControls } from "@/components/admin-table-controls";
import { MarketDeleteControl } from "@/components/market-delete-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import styles from "./market-management.module.css";

export type ManagedMarket = {
  id: string; name: string; type: string; address: string; description: string;
  entrance: string; timezone: string; latitude: number | null; longitude: number | null; active: boolean;
  _count: { zones: number; stalls: number; sessions: number };
};
function typeName(type: string) {
  return type === "SMALL" ? "ตลาดเล็ก" : type === "LARGE" ? "ตลาดใหญ่" : type === "OTHER" ? "ตลาดประเภทอื่น" : type;
}
function marketFields(market: ManagedMarket | null): FormField[] {
  return [
    { name: "name", label: "ชื่อตลาด", required: true, value: market?.name ?? "" },
    { name: "type", label: "ประเภท", type: "select", required: true, value: market?.type ?? "SMALL", options: [
      { value: "SMALL", label: "ตลาดเล็ก" }, { value: "LARGE", label: "ตลาดใหญ่" }, { value: "OTHER", label: "ตลาดประเภทอื่น" },
      ...(market && !["SMALL", "LARGE", "OTHER"].includes(market.type) ? [{ value: market.type, label: market.type }] : []),
    ] },
    { name: "address", label: "ที่อยู่ (ไม่บังคับ)", value: market?.address ?? "" },
    { name: "description", label: "รายละเอียด", type: "textarea", value: market?.description ?? "" },
    { name: "entrance", label: "ทางเข้า / จุดสังเกต", value: market?.entrance ?? "" },
    { name: "timezone", label: "เขตเวลา", required: true, value: market?.timezone ?? "Asia/Bangkok" },
    { name: "latitude", label: "ละติจูด (เฉพาะพิกัดจริง)", type: "number", min: -90, max: 90, step: "any", value: market?.latitude },
    { name: "longitude", label: "ลองจิจูด (เฉพาะพิกัดจริง)", type: "number", min: -180, max: 180, step: "any", value: market?.longitude },
  ];
}

export function MarketManagement({ markets }: { markets: ManagedMarket[] }) {
  const [editing, setEditing] = useState<ManagedMarket | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ dirty: false, busy: false });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const onStateChange = useCallback((value: { dirty: boolean; busy: boolean }) => setState(value), []);
  function begin(market: ManagedMarket | null, button: HTMLButtonElement) {
    trigger.current = button;
    setEditing(market);
    setState({ dirty: false, busy: false });
    setOpen(true);
  }
  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }
  return <div className="stack">
    <div className="page-heading">
      <div><h1>ตลาดและพื้นที่ขาย</h1></div>
      <Button type="button" onClick={(event) => begin(null, event.currentTarget)}><Plus data-icon="inline-start" />เพิ่มตลาด</Button>
    </div>
    {markets.length ? <AdminTableControls total={markets.length} headers={["ตลาด", "พื้นที่", "สถานะ", "จัดการ"]}
      searchValues={markets.map((row) => `${row.name} ${typeName(row.type)} ${row.address} ${row.active ? "เปิดแสดงผล" : "ปิดแสดงผล"}`)}
      rows={markets.map((row) => [
        <div key="name"><strong>{row.name}</strong><small className="block text-muted-foreground">{typeName(row.type)}</small></div>,
        `${row._count.zones} โซน · ${row._count.stalls} ล็อก`,
        <Badge key="status" variant={row.active ? "secondary" : "outline"}>{row.active ? "เปิดแสดงผล" : "ปิดแสดงผล"}</Badge>,
        <div key="actions" className={styles.actions}>
          <Button type="button" variant="outline" size="sm" aria-label={`แก้ไขตลาด ${row.name}`} onClick={(event) => begin(row, event.currentTarget)}><Pencil data-icon="inline-start" />แก้ไข</Button>
          <Button asChild variant="outline" size="sm"><Link href={`/admin/markets/${row.id}/layout`}><Map data-icon="inline-start" />จัดผัง</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={`/admin/markets/${row.id}/schedule`}><CalendarDays data-icon="inline-start" />วันเปิด</Link></Button>
          <ApiButton endpoint={`/api/admin/markets/${row.id}`} body={{ active: !row.active }} confirmMessage={row.active ? "ปิดแสดงผลตลาดนี้?" : undefined}>{row.active ? "ปิดแสดงผล" : "เปิดแสดงผล"}</ApiButton>
          <MarketDeleteControl id={row.id} name={row.name} />
        </div>,
      ])} /> : <div className="content-panel"><h2>เริ่มจากตลาดแรก</h2><p>เพิ่มชื่อตลาดและประเภท จากนั้นค่อยจัดผังและวันเปิด</p></div>}
    <AppDialog open={open} onOpenChange={changeOpen} title={editing ? "แก้ไขตลาด" : "เพิ่มตลาด"} description="ชื่อและประเภทเป็นข้อมูลหลัก ผังและวันเปิดจัดการแยกได้" dirty={state.dirty} busy={state.busy}>
      {open && <ApiForm key={editing?.id ?? "new"} endpoint={editing ? `/api/admin/markets/${editing.id}` : "/api/admin/markets"} method={editing ? "PATCH" : "POST"}
        fields={marketFields(editing)} advancedFrom={3} submit={editing ? "บันทึกข้อมูลตลาด" : "สร้างตลาด"}
        onSaved={() => changeOpen(false)} onCancel={() => changeOpen(false)} onStateChange={onStateChange} />}
    </AppDialog>
  </div>;
}
