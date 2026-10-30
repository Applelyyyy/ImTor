import Link from "next/link";
import { requireUser } from "@/components/auth-guard";
import { ApiForm } from "@/components/forms";
import { LogoutButton } from "@/components/auth-buttons";
import { PageHeading } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
export const metadata = { title: "โปรไฟล์ของคุณ" };
export default async function Profile() {
  const user = await requireUser();
  return (
    <div className="shell page">
      <PageHeading
        title="พื้นที่ของคุณ"
        description="ดูแลบัญชีและมื้ออร่อยของคุณได้ที่นี่"
      />
      <div className="two-col">
        <div className="form-panel">
          <h2>ข้อมูลส่วนตัว</h2>
          <p className="help-text mb-5">{user.email}</p>
          <ApiForm
            endpoint="/api/profile"
            method="PATCH"
            fields={[
              {
                name: "name",
                label: "ชื่อที่แสดง",
                value: user.name,
                required: true,
              },
            ]}
            submit="บันทึกชื่อ"
          />
          <div className="mt-8">
            <LogoutButton />
          </div>
        </div>
        <div className="content-panel stack">
          <h2>วันนี้อยากทำอะไร?</h2>
          <Button asChild variant="outline">
            <Link href="/reservations">ดูการจองของฉัน</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/merchant">จัดการร้านค้า / เปิดร้านใหม่</Link>
          </Button>
          {["ADMIN", "SUPERADMIN"].includes(user.role) && (
            <Button asChild>
              <Link href="/admin">จัดการระบบ</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
