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
      <h1>อิ่มต่อ ยินดีต้อนรับ</h1>
      <p>
        เข้าสู่ระบบเพื่อจองมื้อโปรด เปิดร้านของคุณ
        <br />
        และเป็นส่วนหนึ่งของชุมชนอิ่มต่อ
      </p>
      <LoginButton
        enabled={
          !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET
        }
      />
      <p className="help-text">
        แค่เดินดูของอร่อย? ไม่ต้องเข้าสู่ระบบก็ค้นหาได้
      </p>
      <Link className="link-button" href="/">
        กลับไปค้นพบของอร่อย
      </Link>
    </div>
  );
}
