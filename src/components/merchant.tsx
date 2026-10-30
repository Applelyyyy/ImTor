import Link from "next/link";
import { requireUser } from "@/components/auth-guard";
import { dashboardStore } from "@/lib/queries";
import { EmptyState } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
import type { FormField } from "@/components/forms";
export async function merchantStore() {
  const user = await requireUser();
  return dashboardStore(user.id);
}
export function NoStore() {
  return (
    <EmptyState
      title="ร้านดี ๆ เริ่มได้ที่นี่"
      description="สร้างร้านของคุณก่อน เพื่อเริ่มเพิ่มสินค้าและเลือกตลาดที่ออกขาย"
    >
      <Button asChild>
        <Link href="/become-vendor">เปิดร้านของฉัน</Link>
      </Button>
    </EmptyState>
  );
}
export function productFields(
  categories: { id: string; name: string }[],
  p?: {
    name: string;
    description: string;
    imageUrl: string;
    price: number;
    categoryId: string;
    mode: string;
    reservable: boolean;
    stock: number | null;
    allergens: string | null;
    storage: string | null;
    pickupStart: Date | null;
    pickupEnd: Date | null;
  },
): FormField[] {
  const local = (d: Date | null | undefined) =>
    d ? new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16) : "";
  const fields: FormField[] = [
    { name: "name", label: "ชื่อสินค้า", required: true, value: p?.name },
    {
      name: "description",
      label: "รายละเอียดสินค้า",
      type: "textarea",
      value: p?.description,
    },
    {
      name: "imageUrl",
      label: "ภาพสินค้า",
      type: "upload",
      required: true,
      value: p?.imageUrl,
    },
    {
      name: "price",
      label: "ราคาปกติ (บาท)",
      type: "number",
      factor: 100,
      step: "0.01",
      min: 0,
      required: true,
      value: p ? p.price / 100 : undefined,
    },
    {
      name: "categoryId",
      label: "หมวดหมู่",
      type: "select",
      required: true,
      value:
        p?.categoryId ||
        categories.find((c) => !c.id.includes(":"))?.id ||
        categories[0]?.id,
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: "mode",
      label: "รูปแบบการขาย",
      type: "select",
      required: true,
      value: p?.mode || "REGULAR",
      options: [
        { value: "REGULAR", label: "ขายราคาปกติ" },
        { value: "DISCOUNT", label: "สินค้าลดราคา (ตั้งกฎหลังบันทึก)" },
        { value: "RESCUE", label: "อิ่มคุ้ม ช่วยลดอาหารเหลือ" },
      ],
    },
    {
      name: "stock",
      label: "จำนวนคงเหลือ (ชิ้น)",
      type: "number",
      min: 0,
      value: p?.stock,
      description: "เว้นว่างเมื่อไม่จำกัดจำนวน ต้องระบุจำนวนหากเปิดรับจอง",
    },
    {
      name: "reservable",
      label: "เปิดรับการจองออนไลน์",
      type: "checkbox",
      value: p?.reservable,
    },
    {
      name: "pickupStart",
      label: "เริ่มรับสินค้า",
      type: "datetime-local",
      value: local(p?.pickupStart),
    },
    {
      name: "pickupEnd",
      label: "รับสินค้าภายใน",
      type: "datetime-local",
      value: local(p?.pickupEnd),
    },
    { name: "allergens", label: "สารก่อภูมิแพ้", value: p?.allergens },
    { name: "storage", label: "คำแนะนำการเก็บรักษา", value: p?.storage },
  ];
  const primary = ["imageUrl", "name", "price"];
  return [
    ...primary.map((name) => fields.find((f) => f.name === name)!),
    ...fields.filter((f) => !primary.includes(f.name)),
  ];
}
