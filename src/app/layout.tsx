import type { Metadata } from "next";
import { Mali, Kodchasan } from "next/font/google";
import Link from "next/link";
import {
  Leaf,
  MapPinned,
  ShoppingBag,
  UserRound,
  Store,
} from "lucide-react";
import { publicBranding } from "@/lib/queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { currentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearch } from "@/components/global-search";
import "./globals.css";
const mali = Mali({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mali",
  display: "swap",
});
const kodchasan = Kodchasan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kodchasan",
  display: "swap",
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
    <html lang="th" className={`${mali.variable} ${kodchasan.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          ข้ามไปเนื้อหา
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link className="brand" href="/" aria-label={`${siteName} หน้าแรก`}>
              <span className="brand-title">{siteName}</span>
            </Link>
            <nav className="desktop-nav" aria-label="เมนูหลัก">
              <Link href="/">หน้าแรก</Link>
              <Link href="/markets">ตลาดวันนี้</Link>
              <Link href="/explore">สินค้าและร้านค้า</Link>
            </nav>
            <div className="header-actions">
              <GlobalSearch />
              <Button asChild variant="outline">
                <Link href={user ? "/merchant" : "/become-vendor"}>
                  <Store data-icon="inline-start" />
                  เปิดร้าน
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
        <Toaster position="top-right" closeButton visibleToasts={2} toastOptions={{duration:4000}} offset={{top:"calc(var(--site-header-height) + env(safe-area-inset-top, 0px) + 12px)",right:16}} mobileOffset={{top:"calc(var(--site-header-height) + env(safe-area-inset-top, 0px) + 12px)",left:16,right:16}} />
        <main id="main" tabIndex={0} aria-label="เนื้อหาหลัก">
        {branding.announcement && (
          <div className="shell site-announcement">
            <Alert>
              <AlertDescription>{branding.announcement}</AlertDescription>
            </Alert>
          </div>
        )}
          {children}
        </main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <Link className="footer-brand" href="/" aria-label={`${siteName} หน้าแรก`}>
              <span>{siteName}</span>
            </Link>
            <nav className="footer-links" aria-label="เมนูส่วนท้าย">
              <Link href="/explore">สินค้าและร้านค้า</Link>
              <Link href="/markets">ตลาด</Link>
              <Link href="/become-vendor">เปิดร้าน</Link>
            </nav>
            <small className="footer-copyright">© {new Date().getFullYear()} {siteName}</small>
          </div>
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
          <GlobalSearch mobile />
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
