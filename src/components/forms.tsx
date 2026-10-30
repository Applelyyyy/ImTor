"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { request, RequestError } from "@/lib/api-request";
import { useAppDialogClose } from "@/components/app-dialog";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { signIn, signOut } from "next-auth/react";
import { Check, LoaderCircle, UploadCloud } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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
export function ImageUpload({
  onChange,
  value,
  id,
  onBusyChange,
  disabled,
}: {
  id: string;
  onChange: (v: string) => void;
  value?: string;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "verifying" | "complete" | "error"
  >("idle");
  const [error, setError] = useState("");
  const busy = uploadState === "uploading" || uploadState === "verifying";
  const messages = {
    idle: value ? "ภาพพร้อมใช้งาน" : "JPG, PNG หรือ WebP · ไม่เกิน 5 MB",
    uploading: "กำลังอัปโหลดภาพ…",
    verifying: "กำลังตรวจสอบภาพ…",
    complete: "อัปโหลดภาพแล้ว",
    error: "เลือกรูปภาพเพื่อลองอีกครั้ง",
  };
  async function upload(file: File | undefined) {
    if (!file || lock.current || disabled) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("เลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB");
      setUploadState("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    lock.current = true;
    setUploadState("uploading");
    onBusyChange(true);
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
      if (!put.ok) throw new Error("อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง");
      setUploadState("verifying");
      const final = await request(
        `/api/uploads/${signed.id}/finalize`,
        "POST",
        {},
      );
      onChange(final.imageUrl);
      setUploadState("complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      setUploadState("error");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      lock.current = false;
      onBusyChange(false);
    }
  }
  return (
    <div className="upload-control" aria-busy={busy}>
      <div
        className="upload-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        {value && (
          <div className="upload-preview">
            <Image src={value} alt="ภาพที่เลือก" fill sizes="160px" />
          </div>
        )}
        <div className="upload-actions">
          <input
            ref={inputRef}
            id={id}
            type="file"
            tabIndex={-1}
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || disabled}
            aria-describedby={`${id}-status${error ? ` ${id}-error` : ""}`}
            onChange={(e) => void upload(e.currentTarget.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud data-icon="inline-start" />
            {value ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy || disabled}
              onClick={() => {
                onChange("");
                setUploadState("idle");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              นำภาพออก
            </Button>
          )}
          <p
            id={`${id}-status`}
            className="help-text upload-state"
            role="status"
            data-upload-state={uploadState}
          >
            {busy && (
              <LoaderCircle className="motion-spinner" aria-hidden="true" />
            )}
            {uploadState === "complete" && <Check aria-hidden="true" />}
            {messages[uploadState]}
          </p>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="form-error">
          {error}
        </p>
      )}
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
  advancedLabel = "รายละเอียดเพิ่มเติม",
  onSaved, onCancel, onStateChange,
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
  advancedLabel?: string;
  onSaved?: (data: unknown) => void;
  onCancel?: () => void;
  onStateChange?: (state: {dirty:boolean;busy:boolean}) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const requestClose = useAppDialogClose();
  const hydrated = useHydrated();
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<
    Record<string, boolean>
  >({});
  const uploading = Object.values(uploadingFields).some(Boolean);
  const [refreshing, startRefresh] = useTransition();
  const submitLock = useRef(false);
  const reservationKey = useRef<string | null>(null);
  const reservationAttempt = useRef<Record<string, unknown> | null>(null);
  const [reservationUncertain, setReservationUncertain] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors, isDirty },
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
  const dirty = isDirty || Object.keys(uploads).length > 0;
  const busy = isSubmitting || refreshing || uploading || reservationUncertain;
  useEffect(() => { onStateChange?.({dirty,busy}); },[dirty,busy,onStateChange]);
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
          disabled={isSubmitting || refreshing}
          onBusyChange={(busy) =>
            setUploadingFields((x) => ({ ...x, [f.name]: busy }))
          }
          onChange={(v) => setUploads((x) => ({ ...x, [f.name]: v }))}
        />
      ) : f.type === "textarea" ? (
        <Textarea
          id={`${formId}-${f.name}`}
          rows={4}
          aria-invalid={!!errors[f.name]}
          aria-describedby={
            errors[f.name] ? `${formId}-${f.name}-error` : undefined
          }
          {...register(f.name, { required: f.required })}
        />
      ) : f.type === "select" ? (
        <select
          id={`${formId}-${f.name}`}
          aria-invalid={!!errors[f.name]}
          aria-describedby={
            errors[f.name] ? `${formId}-${f.name}-error` : undefined
          }
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
          aria-invalid={!!errors[f.name]}
          aria-describedby={errors[f.name] ? `${formId}-${f.name}-error` : undefined}
          {...register(f.name, { required: f.required })}
        />
      ) : (
        <Input
          id={`${formId}-${f.name}`}
          type={f.type || "text"}
          min={f.min}
          max={f.max}
          step={f.step}
          readOnly={reservationUncertain}
          aria-invalid={!!errors[f.name]}
          aria-describedby={
            errors[f.name] ? `${formId}-${f.name}-error` : undefined
          }
          {...register(f.name, {
            required: f.required,
            min: f.min,
            max: f.max,
          })}
        />
      )}{" "}
      {f.description && <FieldDescription>{f.description}</FieldDescription>}
      {errors[f.name] && (
        <p id={`${formId}-${f.name}-error`} className="form-error" role="alert">
          กรุณาตรวจสอบ{f.label}
        </p>
      )}
    </Field>
  );
  return (
    <form
      aria-busy={isSubmitting || refreshing || uploading}
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          if (submitLock.current || uploading || refreshing) return;
          submitLock.current = true;
          setError("");
          try {
            const data: Record<string, unknown> = { ...body };
            for (const f of fields) {
              let v =
                f.type === "upload"
                  ? (uploads[f.name] ?? f.value)
                  : values[f.name];
              if (f.required && (v === undefined || v === ""))
                throw new Error(`กรุณาระบุ${f.label}`);
              if (
                f.type === "upload" &&
                !f.required &&
                Object.hasOwn(uploads, f.name) &&
                v === ""
              ) {
                if (method === "PATCH") data[f.name] = null;
                continue;
              }
              if ((v === "" || v === null || v === undefined) && !f.required) {
                // Empty editable copy is a real PATCH value, not an omitted field.
                if (method === "PATCH" && v === "" && (!f.type || ["text", "textarea", "url", "email"].includes(f.type))) {
                  data[f.name] = "";
                  continue;
                }
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
            if (endpoint === "/api/reservations" && method === "POST") {
              reservationKey.current ??= crypto.randomUUID();
              data.idempotencyKey = reservationKey.current;
              reservationAttempt.current ??= data;
            }
            const saved = await request(endpoint, method, reservationAttempt.current ?? data);
            reservationKey.current = null;
            reservationAttempt.current = null;
            setReservationUncertain(false);
            toast.success(success, { id: `form:${endpoint}` });
            onSaved?.(saved);
            startRefresh(() => {
              if (redirect) router.push(redirect);
              else router.refresh();
            });
          } catch (err) {
            if (endpoint === "/api/reservations" && method === "POST") {
              const uncertain = !(err instanceof RequestError) || err.status === undefined || err.status >= 500 || (reservationAttempt.current !== null && reservationUncertain);
              setReservationUncertain(uncertain);
              if (!uncertain) { reservationKey.current = null; reservationAttempt.current = null; }
            }
            setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
          } finally {
            submitLock.current = false;
          }
        })(event);
      }}
    >
      <fieldset disabled={!hydrated || isSubmitting || refreshing} className="min-w-0 border-0 p-0"><FieldGroup>
        {fields.slice(0, advancedFrom ?? fields.length).map(renderField)}
        {advancedFrom !== undefined && (
          <details className="advanced-fields">
            <summary>{advancedLabel}</summary>
            <FieldGroup className="mt-6">
              {fields.slice(advancedFrom).map(renderField)}
            </FieldGroup>
          </details>
        )}
      </FieldGroup>
      {children}</fieldset>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>บันทึกไม่สำเร็จ</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {reservationUncertain && <p role="status" className="help-text">คำขอเดิมอาจบันทึกแล้ว จำนวนถูกเก็บไว้เพื่อไม่จองซ้ำ กดลองรายการเดิม หรือ <a className="underline" href="/reservations">ตรวจสอบการจองของฉัน</a></p>}
      <div className="form-actions">
        <Button
          type="submit"
          className="form-submit"
          disabled={!hydrated || isSubmitting || refreshing || uploading}
          aria-busy={isSubmitting || refreshing}
        >
          {(isSubmitting || refreshing) && (
            <span className="form-submit-spinner" aria-hidden="true">
              <LoaderCircle className="motion-spinner" />
            </span>
          )}
          <span
            className={isSubmitting || refreshing ? "opacity-0" : undefined}
          >
            {reservationUncertain ? "ตรวจสอบคำขอจองเดิมอีกครั้ง" : submit}
          </span>
        </Button>
        {onCancel && <Button type="button" variant="outline" disabled={isSubmitting || refreshing || uploading || reservationUncertain} onClick={requestClose ?? onCancel}>ยกเลิก</Button>}
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
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function run() {
    if (lock.current || refreshing) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await request(endpoint, method, body);
      toast.success("บันทึกแล้ว", { id: `action:${endpoint}:${method}:${JSON.stringify(body)}` });
      setOpen(false);
      startRefresh(() => router.refresh());
    } catch (e) {
      const message = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
      setError(message);
      if (!confirmMessage) toast.error(message, {id:`action-error:${endpoint}`});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        ref={trigger}
        size="sm"
        className="form-submit"
        variant={variant}
        disabled={!hydrated || busy || refreshing}
        aria-busy={busy || refreshing}
        onClick={() => {
          if (confirmMessage) {
            setError("");
            setOpen(true);
          } else void run();
        }}
      >
        {(busy || refreshing) && (
          <span className="form-submit-spinner" aria-hidden="true">
            <LoaderCircle className="motion-spinner" />
          </span>
        )}
        <span className={busy || refreshing ? "opacity-0" : undefined}>
          {children}
        </span>
      </Button>
      {confirmMessage && (
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!busy) setOpen(next);
          }}
        >
          <AlertDialogContent onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการดำเนินการ</AlertDialogTitle>
              <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                variant={variant === "destructive" ? "destructive" : "default"}
                disabled={busy}
                aria-busy={busy}
                onClick={(event) => {
                  event.preventDefault();
                  void run();
                }}
              >
                {busy ? "กำลังบันทึก…" : "ยืนยัน"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
