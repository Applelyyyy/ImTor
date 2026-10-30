"use client";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeFeedback } from "@/components/change-feedback";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppDialog, useAppDialogClose } from "@/components/app-dialog";
import { MerchantProductForm, type MerchantEditableProduct, type ProductEditorState } from "@/components/merchant-product-form";
import { MerchantDiscountForm } from "@/components/merchant-discount-form";
import { InventoryControls } from "@/components/inventory-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { money } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import styles from "./merchant-product-manager.module.css";

type Discount = { id: string; kind: string; value: number; startsAt: string; endsAt: string };
export type ManagedProduct = MerchantEditableProduct & { published: boolean; archived: boolean; currentPrice: number; discounts: Discount[]; demo: boolean };
type Selection = { action: "edit" | "stock" | "price" | "discount" | "archive"; product: ManagedProduct } | { action: "new" };
export function MerchantProductManager({ storeId, categories, products }: { storeId: string; categories: {id:string;name:string}[]; products: ManagedProduct[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const searchId = useId();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [state, setState] = useState<ProductEditorState>({dirty:false,busy:false});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const lock = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => { if (!selection && !refreshing && !busyId) opener.current?.focus({preventScroll:true}); },[selection,refreshing,busyId]);
  const onStateChange = useCallback((next: ProductEditorState) => setState(next), []);
  const close = useCallback(() => setSelection(null), []);
  const saved = useCallback(() => { setSelection(null); startRefresh(() => router.refresh()); }, [router]);
  function open(next: Selection) { setState({dirty:false,busy:false}); setSelection(next); }
  async function mutate(product: ManagedProduct, action: "duplicate" | "publish" | "archive" | "restore" | "delete-discount", discountId?: string) {
    if (lock.current) return;
    lock.current = true; setBusyId(product.id);
    try {
      const endpoint = `/api/products/${encodeURIComponent(product.id)}`;
      const response = await fetch(action === "duplicate" ? `${endpoint}/duplicate` : action === "delete-discount" ? `${endpoint}/discounts/${encodeURIComponent(discountId!)}` : endpoint, {
        method: action === "duplicate" ? "POST" : action === "archive" || action === "delete-discount" ? "DELETE" : "PATCH",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(action === "publish" ? {published:!product.published} : action === "restore" ? {archived:false,published:false} : {}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? "บันทึกไม่สำเร็จ");
      if (!result?.data) throw new Error("ยังไม่ได้รับผลยืนยัน กรุณาตรวจสอบรายการก่อนทำซ้ำ");
      toast.success(action === "duplicate" ? "ทำสำเนาสินค้าแล้ว" : action === "publish" ? product.published ? "ซ่อนสินค้าเรียบร้อย" : "เผยแพร่สินค้าแล้ว" : action === "archive" ? "เก็บสินค้าเข้าคลังแล้ว" : action === "restore" ? "นำกลับเป็นฉบับร่างแล้ว" : "ลบช่วงลดราคาแล้ว", {id:`product:${product.id}:${action}:${discountId ?? ""}`});
      if (action === "archive") setSelection(null);
      startRefresh(() => router.refresh());
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "การเชื่อมต่อขัดข้อง กรุณาตรวจสอบรายการก่อนทำซ้ำ", {id:`product-error:${product.id}`}); }
    finally { lock.current = false; setBusyId(null); }
  }
  const visible = products.filter((p) => p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const active = visible.filter((p) => !p.archived);
  const archived = visible.filter((p) => p.archived);
  const renderRow = (p: ManagedProduct) => <article className={styles.row} key={p.id} aria-label={p.name} data-product-id={p.id}>
    <div className={styles.image}><Image src={p.imageUrl} alt="" fill sizes="68px" /></div>
    <div className={styles.name}>{p.name}</div>
    <div className={styles.price}>{money(p.currentPrice)}{p.currentPrice !== p.price && <del>{money(p.price)}</del>}</div>
    <div className={styles.stock}><ChangeFeedback value={`${p.stock}:${p.published}:${p.archived}`}>{p.stock === null ? "ไม่ติดตามจำนวน" : p.stock === 0 ? "สินค้าหมด" : `คงเหลือ ${p.stock.toLocaleString("th-TH")} ชิ้น`}<small><Badge variant={p.published && !p.archived ? "default" : "secondary"}>{p.archived ? "เก็บเข้าคลัง" : p.published ? "เผยแพร่" : "พักขาย"}</Badge></small></ChangeFeedback></div>
    <div className={styles.actions}>
      <Button variant="outline" size="sm" disabled={!hydrated || !!busyId || refreshing} onClick={(event) => {opener.current=event.currentTarget;open({action:"edit",product:p});}}>แก้ไข</Button>
      <DropdownMenu open={menuId === p.id} onOpenChange={(next) => setMenuId(next ? p.id : null)}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"
        // Open after pointer release so a newly positioned menu cannot consume the trigger's pointer-up.
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setMenuId((current) => current === p.id ? null : p.id)}
        onPointerDownCapture={(event)=>{opener.current=event.currentTarget;}} onKeyDownCapture={(event)=>{opener.current=event.currentTarget;}} aria-label={`จัดการ ${p.name}`} disabled={!hydrated || !!busyId || refreshing}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => open({action:"edit",product:p})}>แก้ไข</DropdownMenuItem>
        {!p.archived && <><DropdownMenuItem onSelect={() => open({action:"stock",product:p})}>ปรับจำนวน</DropdownMenuItem><DropdownMenuItem onSelect={() => open({action:"price",product:p})}>เปลี่ยนราคา</DropdownMenuItem><DropdownMenuItem onSelect={() => open({action:"discount",product:p})}>ตั้งส่วนลด</DropdownMenuItem></>}
        <DropdownMenuItem onSelect={() => void mutate(p,"duplicate")}>ทำซ้ำ</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void mutate(p,p.archived ? "restore" : "publish")}>{p.archived ? "นำกลับเป็นฉบับร่าง" : p.published ? "ซ่อนสินค้า" : "เผยแพร่สินค้า"}</DropdownMenuItem>
        {!p.archived && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => open({action:"archive",product:p})}>ลบสินค้า / เก็บเข้าคลัง</DropdownMenuItem></>}
      </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
    </div>
  </article>;
  const selected = selection && "product" in selection ? selection.product : undefined;
  // Discount deletes refresh the server projection without remounting an in-progress form.
  const currentDiscounts = selected ? products.find((p) => p.id === selected.id)?.discounts ?? selected.discounts : [];
  const title = selection?.action === "new" ? "เพิ่มสินค้า" : selection?.action === "edit" ? "แก้ไขสินค้า" : selection?.action === "stock" ? "ปรับจำนวนสินค้า" : selection?.action === "price" ? "เปลี่ยนราคา" : selection?.action === "discount" ? "ตั้งส่วนลด" : "เก็บสินค้าเข้าคลัง?";
  return <div className={styles.manager}>
    <div className={styles.heading}><h1>สินค้าของฉัน</h1><Button disabled={!hydrated || !!busyId || refreshing} onClick={(event) => {opener.current=event.currentTarget;open({action:"new"});}}>+ เพิ่มสินค้า</Button></div>
    <form className={styles.search} role="search" onSubmit={(event) => {event.preventDefault();setQuery(search.trim());}}><label htmlFor={searchId} className="sr-only">ค้นหาสินค้าของฉัน</label><Input id={searchId} type="search" placeholder="ค้นหาสินค้าของฉัน" value={search} onChange={(event) => {setSearch(event.target.value);if(!event.target.value.trim())setQuery("");}} /><Button type="submit" variant="outline">ค้นหา</Button></form>
    {active.length ? <div className={styles.list}>{active.map(renderRow)}</div> : <div className={styles.empty}>{query ? "ไม่พบสินค้าที่ค้นหา" : "ยังไม่มีสินค้า เพิ่มภาพ ชื่อ และราคา เพื่อเริ่มขาย"}</div>}
    {!!archived.length && <details className="merchant-optional"><summary>สินค้าที่เก็บเข้าคลัง ({archived.length})</summary><div className={`${styles.list} mt-4`}>{archived.map(renderRow)}</div></details>}
    <AppDialog restoreFocusRef={opener} open={!!selection} onOpenChange={(value) => {if (!value) close();}} title={title} description={selected?.name} dirty={state.dirty} busy={state.busy || !!busyId || refreshing}>
      {selection?.action === "new" && <MerchantProductForm key="new" storeId={storeId} categories={categories} onSaved={saved} onCancel={close} onStateChange={onStateChange} />}
      {selection?.action === "edit" && selected && <MerchantProductForm key={selected.id} storeId={storeId} categories={categories} product={selected} onSaved={saved} onCancel={close} onStateChange={onStateChange} />}
      {selection?.action === "stock" && selected && <>{selected.stock === null ? <div className="stack"><p>สินค้านี้ไม่ติดตามจำนวน เปิดการติดตามในข้อมูลสินค้าเพื่อเริ่มกำหนดจำนวน</p><Button onClick={() => open({action:"edit",product:selected})}>แก้ไขสินค้า</Button></div> : <InventoryControls key={selected.id} productId={selected.id} available={selected.stock} onStateChange={onStateChange} />}</>}
      {selection?.action === "price" && selected && <PriceEditor key={selected.id} product={selected} onSaved={saved} onCancel={close} onStateChange={onStateChange} />}
      {selection?.action === "discount" && selected && <div className={styles.discounts}>{currentDiscounts.map((d) => <div key={d.id} className={styles.discountRow}><div><strong>{d.kind === "FIXED" ? `ขาย ${money(d.value)}` : d.kind === "FINAL_PERCENT" ? `ขาย ${d.value}% ของราคาปกติ` : `ลด ${d.value}%`}</strong><p>{new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"}).format(new Date(d.startsAt))} – {new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"}).format(new Date(d.endsAt))}</p></div><Button variant="outline" size="sm" disabled={!!busyId || state.busy} onClick={() => void mutate(selected,"delete-discount",d.id)}>ลบช่วงลด</Button></div>)}<MerchantDiscountForm productId={selected.id} onSaved={saved} onCancel={close} onStateChange={onStateChange} /></div>}
      {selection?.action === "archive" && selected && <div className="stack"><p>ลูกค้าจะไม่เห็นสินค้า แต่ประวัติการจองและราคาเดิมยังอยู่ นำกลับเป็นฉบับร่างได้ภายหลัง</p><div className={`form-actions ${styles.footer}`}><Button variant="destructive" disabled={!!busyId || refreshing} onClick={() => void mutate(selected,"archive")}>{busyId ? "กำลังบันทึก…" : "ยืนยันเก็บเข้าคลัง"}</Button><Button variant="outline" disabled={!!busyId} onClick={close}>ยกเลิก</Button></div></div>}
    </AppDialog>
  </div>;
}

function PriceEditor({product,onSaved,onCancel,onStateChange}:{product:ManagedProduct;onSaved:()=>void;onCancel:()=>void;onStateChange:(state:ProductEditorState)=>void}) {
  const id = useId();
  const requestClose = useAppDialogClose();
  const [value,setValue] = useState(String(product.price / 100));
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);
  const dirty = value !== String(product.price / 100);
  // Events report state immediately; no field can change during a pending request.
  function update(next:string) {setValue(next);onStateChange({dirty:next !== String(product.price / 100),busy:false});}
  return <form className="stack" onSubmit={async (event) => {
    event.preventDefault(); if(lock.current)return;
    if(!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 1_000_000) {toast.error("ระบุราคาเป็นบาท ไม่เกินสองตำแหน่งทศนิยม");return;}
    lock.current=true;setBusy(true);onStateChange({dirty,busy:true});
    try {
      const response=await fetch(`/api/products/${encodeURIComponent(product.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({price:Math.round(Number(value)*100)})});
      const result=await response.json().catch(()=>null);
      if(!response.ok || !result?.data?.id)throw new Error(result?.error?.message??"ยังไม่ได้รับผลยืนยันการเปลี่ยนราคา");
      toast.success("เปลี่ยนราคาแล้ว",{id:`product-price:${product.id}`});onStateChange({dirty:false,busy:false});onSaved();
    } catch(cause) {toast.error(cause instanceof Error?cause.message:"การเชื่อมต่อขัดข้อง");onStateChange({dirty,busy:false});}
    finally {lock.current=false;setBusy(false);}
  }}><Field><FieldLabel htmlFor={id}>ราคาใหม่ (บาท)</FieldLabel><Input id={id} type="number" inputMode="decimal" min={0} max={1_000_000} step="0.01" required disabled={busy} value={value} onChange={(event)=>update(event.target.value)} /></Field><p className="help-text">ราคาเดิม {money(product.price)} · ไม่เปลี่ยนราคาของรายการที่จองไว้แล้ว</p><div className={`form-actions ${styles.footer}`}><Button type="submit" disabled={busy}>{busy?"กำลังบันทึก…":"บันทึกราคา"}</Button><Button data-dialog-cancel type="button" variant="outline" disabled={busy} onClick={requestClose ?? onCancel}>ยกเลิก</Button></div></form>;
}
