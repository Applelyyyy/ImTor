"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAppDialogClose } from "@/components/app-dialog";
import { ImageUpload } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { merchantProductInput, type MerchantProductDraft } from "@/lib/merchant-product-input";
import styles from "./merchant-product-manager.module.css";

export type MerchantEditableProduct = {
  id: string; name: string; imageUrl: string; price: number; categoryId: string;
  description: string; mode: string; reservable: boolean; stock: number | null;
  pickupStart: string | null; pickupEnd: string | null; allergens: string | null; storage: string | null;
};
export type ProductEditorState = { dirty: boolean; busy: boolean };
export function MerchantProductForm({ storeId, categories, product, onSaved, onCancel, onStateChange }: {
  storeId: string; categories: { id: string; name: string }[]; product?: MerchantEditableProduct;
  onSaved?: () => void; onCancel?: () => void; onStateChange?: (state: ProductEditorState) => void;
}) {
  const id = useId();
  const requestClose = useAppDialogClose();
  const hydrated = useHydrated();
  const router = useRouter();
  const local = (at: string | null | undefined) => at ? new Date(new Date(at).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "";
  const [draft, setDraft] = useState<MerchantProductDraft>({
    name: product?.name ?? "", imageUrl: product?.imageUrl ?? "", price: product ? String(product.price / 100) : "",
    categoryId: product?.categoryId ?? categories.find((c) => !c.id.includes(":"))?.id ?? categories[0]?.id ?? "",
    description: product?.description ?? "", mode: product?.mode ?? "REGULAR", reservable: product?.reservable ?? false,
    tracking: product?.stock !== null && product?.stock !== undefined,
    quantity: product?.stock !== null && product?.stock !== undefined ? String(product.stock) : "",
    pickupStart: local(product?.pickupStart), pickupEnd: local(product?.pickupEnd), allergens: product?.allergens ?? "", storage: product?.storage ?? "",
  });
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const lock = useRef(false);
  // A lost response must replay the exact request, not new data with an old stock key.
  const pending = useRef<string | null>(null);
  const dirty = JSON.stringify(draft) !== baseline;
  const blocked = !hydrated || busy || refreshing || uploading;
  useEffect(() => { onStateChange?.({ dirty, busy: busy || refreshing || uploading || uncertain }); }, [dirty, busy, refreshing, uploading, uncertain, onStateChange]);
  const update = <K extends keyof MerchantProductDraft>(key: K, value: MerchantProductDraft[K]) => setDraft((old) => ({ ...old, [key]: value }));
  async function submit() {
    if (lock.current || blocked) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (!pending.current) {
        const data = merchantProductInput(draft, product, product ? crypto.randomUUID() : undefined);
        pending.current = JSON.stringify({ ...(!product ? { storeId } : {}), ...data });
      }
      const response = await fetch(product ? `/api/products/${encodeURIComponent(product.id)}` : "/api/products", { method: product ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: pending.current });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) pending.current = null;
        if (response.status === 409) startRefresh(() => router.refresh());
        throw new Error(result?.error?.message ?? "บันทึกสินค้าไม่สำเร็จ");
      }
      if (typeof result?.data?.id !== "string") throw new Error("ยังไม่ได้รับผลยืนยันจากระบบ กรุณาตรวจสอบรายการเดิมอีกครั้ง");
      pending.current = null; setUncertain(false); setBaseline(JSON.stringify(draft));
      toast.success(product ? "บันทึกข้อมูลสำเร็จ" : "เพิ่มสินค้าแล้ว", { id: `product-save:${result.data.id}` });
      startRefresh(() => { router.refresh(); if (onSaved) onSaved(); else router.push("/merchant/products"); });
    } catch (cause) { setUncertain(!!pending.current); setError(cause instanceof Error ? cause.message : "กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form className={`merchant-product-form ${styles.productForm}`} aria-busy={blocked} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <fieldset disabled={!hydrated || busy || refreshing || uncertain} className="merchant-form-fields">
      <legend className="sr-only">ข้อมูลสินค้า</legend>
      <div className={styles.basics}>
        <Field className={styles.photo}><FieldLabel htmlFor={`${id}-photo`}>ภาพสินค้า *</FieldLabel><ImageUpload id={`${id}-photo`} value={draft.imageUrl} onChange={(value) => update("imageUrl", value)} onBusyChange={setUploading} disabled={!hydrated || busy || refreshing || uncertain} /></Field>
        <FieldGroup>
          <Field><FieldLabel htmlFor={`${id}-name`}>ชื่อสินค้า *</FieldLabel><Input id={`${id}-name`} name="name" required maxLength={160} value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="เช่น ข้าวกะเพราไก่" /></Field>
          <Field><FieldLabel htmlFor={`${id}-price`}>ราคา (บาท) *</FieldLabel><Input id={`${id}-price`} name="price" inputMode="decimal" type="number" min={0} max={1_000_000} step="0.01" required value={draft.price} onChange={(e) => update("price", e.target.value)} placeholder="45" /></Field>
        </FieldGroup>
      </div>
      <section className={styles.stockSection} aria-label="จำนวนสินค้า">
        <div className={styles.switchRow}><label htmlFor={`${id}-tracking`}>ติดตามจำนวนสินค้า</label><Switch id={`${id}-tracking`} checked={draft.tracking} disabled={draft.reservable} onCheckedChange={(value) => update("tracking", value)} /></div>
        {draft.tracking ? <Field><FieldLabel htmlFor={`${id}-quantity`}>จำนวนสินค้าคงเหลือ (ชิ้น)</FieldLabel><div className={styles.stepper}>
          <Button type="button" variant="outline" aria-label="ลดจำนวนสินค้า" disabled={!/^\d+$/.test(draft.quantity) || Number(draft.quantity) <= 0} onClick={() => update("quantity", String(Number(draft.quantity) - 1))}>−</Button>
          <Input id={`${id}-quantity`} name="stock" type="number" inputMode="numeric" min={0} max={1_000_000} step={1} required value={draft.quantity} onChange={(e) => update("quantity", e.target.value)} />
          <Button type="button" variant="outline" aria-label="เพิ่มจำนวนสินค้า" disabled={!/^\d*$/.test(draft.quantity) || Number(draft.quantity) >= 1_000_000} onClick={() => update("quantity", String(Number(draft.quantity) + 1))}>+</Button>
        </div><FieldDescription>0 หมายถึงสินค้าหมด ไม่รวมสินค้าที่ลูกค้าจองไว้แล้ว</FieldDescription></Field> : <p className="help-text">ไม่ติดตามจำนวน · ลูกค้าแวะซื้อที่ร้าน</p>}
      </section>
      <details className="merchant-optional">
        <summary>ตั้งค่าเพิ่มเติม</summary>
        <FieldGroup className="mt-4">
          <Field><FieldLabel htmlFor={`${id}-category`}>หมวดหมู่</FieldLabel><select id={`${id}-category`} value={draft.categoryId} onChange={(e) => update("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field><FieldLabel htmlFor={`${id}-description`}>รายละเอียดสินค้า</FieldLabel><Textarea id={`${id}-description`} maxLength={4000} value={draft.description} onChange={(e) => update("description", e.target.value)} /></Field>
          <Field><FieldLabel htmlFor={`${id}-pricing`}>รูปแบบราคา</FieldLabel><select id={`${id}-pricing`} value={draft.mode} onChange={(e) => update("mode", e.target.value)}><option value="REGULAR">ราคาปกติ</option><option value="DISCOUNT">มีส่วนลดตามช่วงเวลา</option><option value="RESCUE">อาหารช่วยลดเหลือ</option></select><FieldDescription>ตั้งช่วงส่วนลดได้จากเมนูสินค้า หลังบันทึกสินค้า</FieldDescription></Field>
          <div className={styles.switchRow}><label htmlFor={`${id}-reservable`}>เปิดรับจองออนไลน์</label><Switch id={`${id}-reservable`} checked={draft.reservable} onCheckedChange={(value) => setDraft((old) => ({ ...old, reservable: value, tracking: value || old.tracking }))} /></div>
          {(draft.reservable || draft.mode === "RESCUE") && <>
            <Field><FieldLabel htmlFor={`${id}-pickup-start`}>เริ่มรับสินค้า (เวลากรุงเทพฯ){draft.reservable ? " *" : ""}</FieldLabel><Input id={`${id}-pickup-start`} type="datetime-local" required={draft.reservable} value={draft.pickupStart} onChange={(e) => update("pickupStart", e.target.value)} /></Field>
            <Field><FieldLabel htmlFor={`${id}-pickup-end`}>รับสินค้าภายใน (เวลากรุงเทพฯ) *</FieldLabel><Input id={`${id}-pickup-end`} type="datetime-local" required value={draft.pickupEnd} onChange={(e) => update("pickupEnd", e.target.value)} /></Field>
          </>}
          <Field><FieldLabel htmlFor={`${id}-allergens`}>สารก่อภูมิแพ้{draft.mode === "RESCUE" ? " *" : ""}</FieldLabel><Input id={`${id}-allergens`} maxLength={1000} required={draft.mode === "RESCUE"} value={draft.allergens} onChange={(e) => update("allergens", e.target.value)} /></Field>
          <Field><FieldLabel htmlFor={`${id}-storage`}>คำแนะนำการเก็บรักษา{draft.mode === "RESCUE" ? " *" : ""}</FieldLabel><Input id={`${id}-storage`} maxLength={1000} required={draft.mode === "RESCUE"} value={draft.storage} onChange={(e) => update("storage", e.target.value)} /></Field>
        </FieldGroup>
      </details>
    </fieldset>
    {error && <Alert variant="destructive"><AlertTitle>ยังไม่ได้บันทึก</AlertTitle><AlertDescription>{error}{uncertain && <p>{product ? "ผลรายการยังไม่แน่นอน ลองรายการเดิมเพื่อป้องกันปรับจำนวนซ้ำ" : "ผลการเพิ่มสินค้ายังไม่แน่นอน กลับไปตรวจสอบรายการก่อนเพิ่มสินค้าอีกครั้ง"}</p>}</AlertDescription></Alert>}
    <div className={`form-actions ${styles.footer}`}><Button type="submit" disabled={blocked || (uncertain && !product)}>{busy || refreshing ? "กำลังบันทึก…" : uncertain ? "ตรวจสอบและลองรายการเดิม" : product ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มสินค้า"}</Button>{uncertain && !product && <Button type="button" variant="outline" disabled={blocked} onClick={() => { pending.current = null; setUncertain(false); router.refresh(); if (onCancel) onCancel(); else router.push("/merchant/products"); }}>กลับไปตรวจสอบรายการสินค้า</Button>}{onCancel ? <Button data-dialog-cancel type="button" variant="outline" disabled={blocked || uncertain} onClick={requestClose ?? onCancel}>ยกเลิก</Button> : <Button asChild variant="outline"><Link href="/merchant/products">กลับไปสินค้า</Link></Button>}</div>
  </form>;
}
