import Link from "next/link";
import { merchantStore, NoStore } from "@/components/merchant";
import { PageHeading } from "@/components/marketplace";
import { ApiButton } from "@/components/forms";
import { ContextualForm } from "@/components/contextual-form";
import { Button } from "@/components/ui/button";
export default async function MerchantSettings() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  return <>
    <PageHeading title="ตั้งค่าร้าน" />
    <section className="content-panel merchant-settings-location mb-6"><div><h2>ตลาดและตำแหน่งร้าน</h2><p>เลือกวันขาย ยืนยันเปิดร้าน หรือเปลี่ยนล็อก</p></div><Button asChild variant="outline"><Link href="/merchant/schedule">จัดการวันและล็อก</Link></Button></section>
    <section className="content-panel"><h2>ข้อมูลหน้าร้าน</h2><p className="mb-4">{s.name}</p><ContextualForm title="แก้ไขข้อมูลร้าน" label="แก้ไขข้อมูลร้าน" endpoint={`/api/stores/${s.id}`} method="PATCH" fields={[
      { name: "name", label: "ชื่อร้าน", required: true, value: s.name },
      { name: "imageUrl", label: "ภาพร้าน", type: "upload", value: s.imageUrl },
      { name: "description", label: "เกี่ยวกับร้าน", type: "textarea", value: s.description },
      { name: "kind", label: "ขายที่ไหน?", type: "select", value: s.kind, required: true, options: [{ value: "MARKET", label: "ออกตลาดนัด" }, { value: "PERMANENT", label: "มีหน้าร้านประจำ" }, { value: "BOTH", label: "หน้าร้านประจำและตลาดนัด" }] },
      { name: "address", label: "ที่อยู่หน้าร้านประจำ (ถ้ามี)", value: s.address },
    ]} submit="บันทึกข้อมูลร้าน" /></section>
    <section className="content-panel mt-8"><h2>ปิดหน้าร้านถาวร</h2><p className="help-text mb-4">ซ่อนร้านและหยุดรับจอง ไม่ลบสินค้า รูปภาพ หรือประวัติการจอง หากต้องการเปิดแสดงผลอีกครั้ง ให้ติดต่อผู้ดูแล</p>{s.hidden && !s.open ? <p role="status">ร้านถูกซ่อนและปิดอยู่</p> : <ApiButton endpoint={`/api/stores/${s.id}`} method="DELETE" variant="destructive" confirmMessage="ปิดและซ่อนหน้าร้านนี้? ข้อมูลและการจองเดิมยังอยู่ ต้องติดต่อผู้ดูแลเพื่อเปิดแสดงผลอีกครั้ง">ปิดและซ่อนร้าน</ApiButton>}</section>
  </>;
}
