import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import {
  Leaf,
  Search,
  MapPinned,
  ShoppingBag,
  UserRound,
  Store,
  ArrowUpRight,
} from "lucide-react";
import { publicBranding } from "@/lib/queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { currentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import "./globals.css";
const thai = localFont({
  src: "../../public/fonts/NotoSansThai.ttf",
  variable: "--font-thai",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: {
    default: "ImTor อิ่มต่อ — อิ่มด้วยกัน ไม่เหลือทิ้ง",
    template: "%s | ImTor อิ่มต่อ",
  },
  description:
    "ค้นพบของอร่อย ร้านใกล้ตัว และตลาดในแคมปัส พร้อมดีลดี ๆ ที่ช่วยลดอาหารเหลือทิ้ง",
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, branding] = await Promise.all([currentUser(), publicBranding()]);
  const siteName = branding.siteName || "อิ่มต่อ";
  return (
    <html lang="th" className={thai.variable}>
      <body>
        <a className="skip-link" href="#main">
          ข้ามไปเนื้อหา
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link className="brand" href="/" aria-label={`${siteName} หน้าแรก`}>
              <span className="brand-mark">
                <Leaf strokeWidth={2.3} />
              </span>
              <span>
                <span className="brand-title">{siteName}</span>
                <span className="brand-en">ImTor</span>
              </span>
            </Link>
            <nav className="desktop-nav" aria-label="เมนูหลัก">
              <Link href="/">ค้นพบของอร่อย</Link>
              <Link href="/markets">ตลาดวันนี้</Link>
              <Link href="/explore">สำรวจร้านค้า</Link>
            </nav>
            <div className="header-actions">
              <Button asChild variant="outline">
                <Link href={user ? "/merchant" : "/become-vendor"}>
                  <Store data-icon="inline-start" />
                  เปิดร้านกับเรา
                </Link>
              </Button>
              <Link
                className="account-link"
                href="/profile"
                aria-label={user ? "ดูโปรไฟล์ของคุณ" : "เข้าสู่ระบบ"}
              >
                <UserRound />
                <span>{user?.name?.split(" ")[0] || "เข้าสู่ระบบ"}</span>
              </Link>
            </div>
          </div>
        </header>
        {branding.announcement && (
          <div className="shell site-announcement">
            <Alert>
              <AlertDescription>{branding.announcement}</AlertDescription>
            </Alert>
          </div>
        )}
        <main id="main">{children}</main>
        <footer className="site-footer shell">
          <div>
            <Link className="brand" href="/">
              <Leaf />
              <span className="brand-title">{siteName}</span>
            </Link>
            <p>อิ่มด้วยกัน ไม่เหลือทิ้ง</p>
          </div>
          <p>ร้านดี ๆ ในแคมปัส ใกล้กว่าที่คิด</p>
          <Link href="/become-vendor">
            เป็นส่วนหนึ่งของอิ่มต่อ <ArrowUpRight size={16} />
          </Link>
        </footer>
        <nav className="mobile-nav" aria-label="เมนูบนมือถือ">
          <Link href="/">
            <Leaf />
            หน้าแรก
          </Link>
          <Link href="/markets">
            <MapPinned />
            ตลาดวันนี้
          </Link>
          <Link href="/explore">
            <Search />
            ค้นหา
          </Link>
          <Link href="/reservations">
            <ShoppingBag />
            การจอง
          </Link>
          <Link href="/profile">
            <UserRound />
            โปรไฟล์
          </Link>
        </nav>
      </body>
    </html>
  );
}
