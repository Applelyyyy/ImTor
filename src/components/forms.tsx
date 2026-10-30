"use client";
import { useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { signIn, signOut } from "next-auth/react";
import { LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "checkbox"
    | "select"
    | "datetime-local"
    | "date"
    | "time"
    | "upload"
    | "url"
    | "email";
  required?: boolean;
  value?: string | number | boolean | null;
  options?: { value: string; label: string }[];
  description?: string;
  min?: number;
  max?: number;
  step?: string;
  factor?: number;
};
async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }
    throw new Error(data?.error?.message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
  }
  return data?.data ?? data;
}
function ImageUpload({
  onChange,
  value,
  id,
}: {
  id: string;
  onChange: (v: string) => void;
  value?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="upload-control">
      {value && (
        <div className="upload-preview">
          <Image src={value} alt="ภาพที่เลือก" fill sizes="140px" />
        </div>
      )}
      <Input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            setError("เลือกภาพขนาดไม่เกิน 5 MB");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const signed = await request("/api/uploads", "POST", {
              mime: file.type,
              size: file.size,
            });
            const put = await fetch(signed.url, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file,
            });
            if (!put.ok) throw new Error("อัปโหลดไม่สำเร็จ");
            const final = await request(
              `/api/uploads/${signed.id}/finalize`,
              "POST",
              {},
            );
            onChange(final.imageUrl);
          } catch (err) {
            setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <p className="help-text">กำลังตรวจสอบและอัปโหลดภาพ…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <FieldDescription>
        <UploadCloud size={14} className="inline" /> JPG, PNG หรือ WebP ไม่เกิน
        5 MB ภาพจะผ่านการตรวจสอบก่อนเผยแพร่
      </FieldDescription>
    </div>
  );
}
export function ApiForm({
  endpoint,
  method = "POST",
  fields,
  body = {},
  submit = "บันทึก",
  redirect,
  success = "บันทึกเรียบร้อยแล้ว",
  children,
  advancedFrom,
}: {
  endpoint: string;
  method?: string;
  fields: FormField[];
  body?: Record<string, unknown>;
  submit?: string;
  redirect?: string;
  success?: string;
  children?: React.ReactNode;
  advancedFrom?: number;
}) {
  const router = useRouter();
  const formId = useId();
  const [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.value ??
          (f.type === "checkbox"
            ? false
            : f.type === "select" && f.required
              ? (f.options?.[0]?.value ?? "")
              : ""),
      ]),
    ),
  });
  const renderField = (f: FormField) => (
    <Field key={f.name} data-invalid={!!errors[f.name]}>
      <FieldLabel htmlFor={`${formId}-${f.name}`}>
        {f.label}
        {f.required ? " *" : ""}
      </FieldLabel>
      {f.type === "upload" ? (
        <ImageUpload
          id={`${formId}-${f.name}`}
          value={uploads[f.name] ?? String(f.value ?? "")}
          onChange={(v) => setUploads((x) => ({ ...x, [f.name]: v }))}
        />
      ) : f.type === "textarea" ? (
        <Textarea
          id={`${formId}-${f.name}`}
          rows={4}
          aria-invalid={!!errors[f.name]}
          {...register(f.name, { required: f.required })}
        />
      ) : f.type === "select" ? (
        <select
          id={`${formId}-${f.name}`}
          aria-invalid={!!errors[f.name]}
          {...register(f.name, { required: f.required })}
        >
          {!f.required && <option value="">ไม่ระบุ</option>}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.type === "checkbox" ? (
        <Input
          id={`${formId}-${f.name}`}
          type="checkbox"
          {...register(f.name, { required: f.required })}
        />
      ) : (
        <Input
          id={`${formId}-${f.name}`}
          type={f.type || "text"}
          min={f.min}
          max={f.max}
          step={f.step}
          aria-invalid={!!errors[f.name]}
          {...register(f.name, {
            required: f.required,
            min: f.min,
            max: f.max,
          })}
        />
      )}{" "}
      {f.description && <FieldDescription>{f.description}</FieldDescription>}
      {errors[f.name] && (
        <p className="form-error" role="alert">
          กรุณาตรวจสอบ{f.label}
        </p>
      )}
    </Field>
  );
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError("");
        setDone(false);
        try {
          const data: Record<string, unknown> = { ...body };
          for (const f of fields) {
            let v =
              f.type === "upload"
                ? (uploads[f.name] ?? f.value)
                : values[f.name];
            if (f.required && (v === undefined || v === ""))
              throw new Error(`กรุณาระบุ${f.label}`);
            if ((v === "" || v === null || v === undefined) && !f.required) {
              if (
                [
                  "stock",
                  "latitude",
                  "longitude",
                  "pickupStart",
                  "pickupEnd",
                ].includes(f.name)
              )
                data[f.name] = null;
              continue;
            }
            if (f.type === "number")
              v = f.factor ? Math.round(Number(v) * f.factor) : Number(v);
            if (f.type === "select" && f.factor) v = Number(v) * f.factor;
            if (f.type === "datetime-local")
              v = new Date(String(v) + "+07:00").toISOString();
            if (f.type === "checkbox") v = !!v;
            data[f.name] = v;
          }
          await request(endpoint, method, data);
          setDone(true);
          if (redirect) router.push(redirect);
          else router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        }
      })}
    >
      <FieldGroup>
        {fields.slice(0, advancedFrom ?? fields.length).map(renderField)}
        {advancedFrom !== undefined && (
          <details className="advanced-fields">
            <summary>
              รายละเอียดเพิ่มเติม หมวดหมู่ การจอง และเวลารับสินค้า
            </summary>
            <FieldGroup className="mt-6">
              {fields.slice(advancedFrom).map(renderField)}
            </FieldGroup>
          </details>
        )}
      </FieldGroup>
      {children}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>บันทึกไม่สำเร็จ</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {done && (
        <p role="status" className="form-success">
          {success}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          )}
          {submit}
        </Button>
      </div>
    </form>
  );
}
export function ApiButton({
  endpoint,
  method = "PATCH",
  body = {},
  children,
  variant = "outline",
  confirmMessage,
}: {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        onClick={async () => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          setBusy(true);
          setError("");
          try {
            await request(endpoint, method, body);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : null}
        {children}
      </Button>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
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
