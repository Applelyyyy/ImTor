"use client";
import { useCallback, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { ApiForm } from "@/components/forms";
import type { ProductEditorState } from "@/components/merchant-product-form";
import { Field, FieldLabel } from "@/components/ui/field";
export function MerchantDiscountForm({ productId, onSaved, onCancel, onStateChange }: { productId: string; onSaved?: () => void; onCancel?: () => void; onStateChange?: (state: ProductEditorState) => void }) {
  const [kind, setKind] = useState("PERCENT_OFF");
  const hydrated = useHydrated();
  const [state, setState] = useState<ProductEditorState>({dirty:false,busy:false});
  const reportState = useCallback((next: ProductEditorState) => {
    setState(next);
    onStateChange?.({dirty: next.dirty || kind !== "PERCENT_OFF", busy:next.busy});
  }, [kind,onStateChange]);
  return <>
    <Field className="mb-5"><FieldLabel htmlFor={`discount-kind-${productId}`}>ลดราคาแบบไหน?</FieldLabel><select id={`discount-kind-${productId}`} value={kind} disabled={!hydrated || state.busy} onChange={(e) => setKind(e.target.value)}><option value="PERCENT_OFF">ลดจากราคาปกติ (%)</option><option value="FIXED">กำหนดราคาขายใหม่ (บาท)</option></select></Field>
    <ApiForm key={kind} onSaved={onSaved} onCancel={onCancel} onStateChange={reportState} endpoint={`/api/products/${productId}/discounts`} body={{ kind, priority: 0 }} fields={[
      { name: "value", label: kind === "FIXED" ? "ราคาขายใหม่ (บาท)" : "ลดราคา (%)", type: "number", min: 0, max: kind === "FIXED" ? 1_000_000 : 100, step: kind === "FIXED" ? "0.01" : "1", ...(kind === "FIXED" ? { factor: 100 } : {}), required: true },
      { name: "startsAt", label: "เริ่มลดราคา (เวลากรุงเทพฯ)", type: "datetime-local", required: true },
      { name: "endsAt", label: "สิ้นสุด (เวลากรุงเทพฯ)", type: "datetime-local", required: true },
      { name: "repeatStart", label: "ลดซ้ำทุกวันตั้งแต่ (ไม่บังคับ)", type: "time" },
      { name: "repeatEnd", label: "ลดซ้ำทุกวันถึง", type: "time" },
      { name: "priority", label: "ลำดับความสำคัญของช่วงลด (ขั้นสูง)", type: "number", value: 0, min: -100, max: 100 },
    ]} advancedFrom={3} advancedLabel="ช่วงลดซ้ำและลำดับขั้นสูง" submit="เพิ่มช่วงลดราคา" />
  </>;
}
