import Link from "next/link";
import { Leaf } from "lucide-react";
import { LoginButton } from "@/components/forms";
export const metadata = { title: "เข้าสู่ระบบ" };
export default function Login() {
  return (
    <div className="auth-page">
      <span className="brand-mark">
        <Leaf />
      </span>
      <h1 className="font-display">ยินดีต้อนรับสู่อิ่มต่อ</h1>
      <p>เข้าสู่ระบบเพื่อจองสินค้าหรือเปิดร้าน</p>
      <LoginButton
        enabled={
          !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET
        }
      />
      <Link className="link-button" href="/">
        ดูสินค้าโดยไม่เข้าสู่ระบบ
      </Link>
    </div>
  );
}
