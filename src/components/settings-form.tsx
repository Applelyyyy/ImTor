"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
export function SettingsForm() {
  const router = useRouter();
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setDone(false);
        const data = new FormData(e.currentTarget);
        try {
          const value = JSON.parse(String(data.get("value")));
          const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: data.get("key"), value }),
          });
          const body = await res.json();
          if (!res.ok)
            throw new Error(body.error?.message || "บันทึกไม่สำเร็จ");
          setDone(true);
          router.refresh();
        } catch (e) {
          setError(
            e instanceof SyntaxError
              ? "ค่า JSON ไม่ถูกต้อง"
              : e instanceof Error
                ? e.message
                : "บันทึกไม่สำเร็จ",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="setting-key">ชื่อค่า</FieldLabel>
          <select id="setting-key" name="key" required>
            {[
              ["siteName", "ชื่อแอป"],
              ["announcement", "ข้อความประกาศ"],
              ["marketRegistrationEnabled", "เปิดรับเข้าร่วมตลาด"],
              ["storeRegistrationEnabled", "เปิดรับร้านใหม่"],
              ["reservationsEnabled", "เปิดรับการจอง"],
              ["foodRescueEnabled", "เปิดอาหารช่วยลดเหลือ"],
              ["requireStoreApproval", "ร้านใหม่ต้องอนุมัติ"],
              ["demoMode", "ป้ายโหมดสาธิต"],
              ["defaultDiscount", "ส่วนลดทั่วไป (ไม่ใช้กับสินค้าปกติ)"],
            ].map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({key})
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="setting-value">ค่า (JSON)</FieldLabel>
          <Textarea
            id="setting-value"
            name="value"
            required
            rows={5}
            defaultValue={'"อิ่มต่อ"'}
          />
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="form-success">
          บันทึกเรียบร้อยแล้ว
        </p>
      )}
      <Button type="submit" disabled={busy}>
        บันทึกการตั้งค่า
      </Button>
    </form>
  );
}
