"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, LayoutDashboard, Package, Store, Users, Map, MapPin, CalendarCheck, ShoppingBag, Flag, ChartNoAxesCombined, Settings, Database, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
const icons = [LayoutDashboard, Package, Store, Users, Map, MapPin, CalendarCheck, ShoppingBag, Flag, ChartNoAxesCombined, Settings, Database, History];
const groups = [
  {
    title: "ภาพรวมและเนื้อหา",
    links: [
      ["", "ภาพรวม"],
      ["products", "สินค้า"],
      ["stores", "ร้านค้า"],
      ["users", "ผู้ใช้งาน"],
    ],
  },
  {
    title: "ตลาดและการขาย",
    links: [
      ["markets", "ตลาดและผัง"],
      ["stalls", "โซนและล็อก"],
      ["attendance", "ร้านที่ออกขาย"],
      ["reservations", "การจอง"],
    ],
  },
  {
    title: "ดูแลระบบ",
    links: [
      ["reports", "รายงานปัญหา"],
      ["analytics", "ผลลัพธ์และสถิติ"],
      ["settings", "ตั้งค่าระบบ"],
      ["demo-generator", "ชุดข้อมูล"],
      ["audit-logs", "บันทึกการจัดการ"],
    ],
  },
];
export function AdminNavigation() {
  const pathname = usePathname(),
    [open, setOpen] = useState(false);
  const navigation = (
    <nav aria-label="เมนูผู้ดูแล" className="admin-navigation">
      {groups.map((group, groupIndex) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          {group.links.map(([path, label], linkIndex) => {
            const Icon = icons[groups.slice(0, groupIndex).reduce((n, g) => n + g.links.length, 0) + linkIndex];
            const href = `/admin${path ? `/${path}` : ""}`;
            const active = path
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
  return (
    <>
      <aside className="sidebar admin-desktop-sidebar">
        <h2>จัดการอิ่มต่อ</h2>
        {navigation}
      </aside>
      <div className="admin-mobile-navigation">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline">
              <Menu data-icon="inline-start" />
              เมนูผู้ดูแล
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle className="admin-navigation-title">จัดการอิ่มต่อ</SheetTitle>
              <SheetDescription>เลือกส่วนที่ต้องการจัดการ</SheetDescription>
            </SheetHeader>
            <div className="p-5 overflow-y-auto">{navigation}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
