"use client";
import {useEffect,useId,useRef,useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {Search,LoaderCircle} from "lucide-react";
import {AppDialog} from "@/components/app-dialog";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {money} from "@/lib/utils";
import type {ProductView} from "@/lib/contracts";
import styles from "./global-search.module.css";
export function GlobalSearch({mobile=false}:{mobile?:boolean}) {
 const [open,setOpen]=useState(false),[q,setQ]=useState("");
 const [items,setItems]=useState<ProductView[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [searched,setSearched]=useState("");
 const pending=useRef<AbortController|null>(null);
 const id=useId();
 useEffect(()=>()=>pending.current?.abort(),[]);
 function changeOpen(next:boolean){if(!next){pending.current?.abort();setLoading(false);}setOpen(next);}
 return <>
  <a href="/explore" className={mobile?undefined:styles.trigger} aria-label="ค้นหาสินค้า ร้าน หรือตลาด" onClick={event=>{event.preventDefault();setOpen(true);}}><Search/><span>{mobile?"ค้นหา":"ค้นหา"}</span></a>
  <AppDialog open={open} onOpenChange={changeOpen} title="ค้นหาสินค้าและร้านค้า" description="ค้นหาชื่อสินค้า ร้าน ตลาด หรือรหัสล็อก">
   <form role="search" className={styles.form} onSubmit={async event=>{
    event.preventDefault();pending.current?.abort();const controller=new AbortController();pending.current=controller;
    const query=q.trim();setLoading(true);setError("");setItems(null);setSearched(query);
    try{
     const response=await fetch(`/api/products?${new URLSearchParams({q:query})}`,{signal:controller.signal});
     const result=await response.json();if(!response.ok||!Array.isArray(result.data))throw new Error("ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง");
     if(!controller.signal.aborted)setItems(result.data);
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"การเชื่อมต่อขัดข้อง");}
    finally{if(!controller.signal.aborted)setLoading(false);}
   }}>
    <label htmlFor={id} className="sr-only">ค้นหาสินค้า ร้าน หรือตลาด</label>
    <Input id={id} value={q} maxLength={160} placeholder="เช่น กะเพรา กาแฟ ตลาดเช้า A01" onChange={e=>setQ(e.target.value)}/>
    <Button type="submit" aria-busy={loading}>{loading?<><LoaderCircle className="motion-spinner"/>กำลังค้นหา</>:"ค้นหา"}</Button>
   </form>
   <p role="status" className="help-text mt-3">{loading?"กำลังค้นหา…":items?`${searched?`ผลการค้นหา “${searched}” · `:""}${items.length} รายการ`:"พิมพ์คำค้น แล้วกด Enter หรือปุ่มค้นหา"}</p>
   {error&&<p role="alert" className="form-error">{error}</p>}
   {items?.length===0&&<div className={`${styles.empty} motion-empty`}><h2>ไม่พบสินค้าที่ค้นหา</h2><p>ลองเปลี่ยนชื่อสินค้า ร้าน หรือตลาด</p></div>}
   {items&&items.length>0&&<ul className={`${styles.results} motion-results`} aria-label="ผลการค้นหา">{items.map(p=><li key={p.id}>
    <Link href={`/product/${encodeURIComponent(p.id)}`} onClick={()=>changeOpen(false)}><Image src={p.imageUrl} alt="" width={64} height={64}/><span><strong>{p.name}</strong><small>{p.store.name}</small><small>{p.location}</small></span><b>{money(p.price.current)}</b></Link>
   </li>)}</ul>}
   <div className="form-actions"><Button variant="outline" asChild><Link href={`/explore?${new URLSearchParams({q:q.trim()})}`} onClick={()=>changeOpen(false)}>ดูสินค้าและตัวกรองทั้งหมด</Link></Button></div>
  </AppDialog>
 </>;
}
