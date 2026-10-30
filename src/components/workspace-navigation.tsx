"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Package, TicketCheck, Settings } from "lucide-react";
const links = [
  { href: "/merchant", label: "หน้าร้าน", icon: Store },
  { href: "/merchant/products", label: "สินค้า", icon: Package },
  { href: "/merchant/reservations", label: "การจอง", icon: TicketCheck },
  { href: "/merchant/settings", label: "ตั้งค่าร้าน", icon: Settings },
];
export function WorkspaceNavigation() {
  const path = usePathname();
  return <nav className="merchant-navigation" aria-label="เมนูร้านของฉัน">{links.map(({ href, label, icon: Icon }) => {
    const active = href === "/merchant" ? path === href : path.startsWith(href);
    const settingsActive = href === "/merchant/settings" && (path === "/merchant/schedule" || path === "/merchant/locations");
    return <Link href={href} key={href} aria-current={active || settingsActive ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>;
  })}</nav>;
}
