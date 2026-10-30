import Link from "next/link";
import { requireUser } from "@/components/auth-guard";
export const metadata = { title: "จัดการร้านค้า" };
const links = [
  ["/merchant", "ภาพรวมร้านค้า"],
  ["/merchant/products", "สินค้าในร้าน"],
  ["/merchant/schedule", "ตารางออกขาย"],
  ["/merchant/locations", "ตำแหน่งและล็อก"],
  ["/merchant/reservations", "รายการจอง"],
  ["/merchant/settings", "ตั้งค่าร้านค้า"],
];
export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="shell workspace">
      <aside className="sidebar">
        <h2>ร้านของฉัน</h2>
        <nav aria-label="เมนูจัดการร้าน">
          {links.map(([url, name]) => (
            <Link href={url} key={url}>
              {name}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
