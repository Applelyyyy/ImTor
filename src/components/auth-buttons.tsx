"use client";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginButton({ enabled = true }: { enabled?: boolean }) {
  return (
    <>
      <Button
        disabled={!enabled}
        variant="outline"
        onClick={() => signIn("google", { callbackUrl: "/profile" })}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.6a4.7 4.7 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.7v2.7A10.4 10.4 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.2 13.7a6.2 6.2 0 0 1 0-3.4V7.6H2.7a10.3 10.3 0 0 0 0 8.8l3.5-2.7Z"
          />
          <path
            fill="#EA4335"
            d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 12 2a10.4 10.4 0 0 0-9.3 5.6l3.5 2.7A6.1 6.1 0 0 1 12 6.1Z"
          />
        </svg>
        เข้าสู่ระบบด้วย Google
      </Button>
      {!enabled && (
        <p className="help-text">
          กำลังเตรียมการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลเพื่อตั้งค่า Google OAuth
        </p>
      )}
    </>
  );
}
export function LogoutButton() {
  return (
    <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
      ออกจากระบบ
    </Button>
  );
}
