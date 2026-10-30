"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type Preview = { name: string; canDelete: boolean; blockers: string[] };
export function MarketDeleteControl({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter(),
    lock = useRef(false);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function call(method: string, suffix = "", body?: unknown) {
    const response = await fetch(`/api/admin/markets/${id}${suffix}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(json.error?.message ?? "ดำเนินการไม่สำเร็จ");
    return json.data;
  }
  return (
    <>
      <Button
        ref={trigger}
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        aria-label={`ลบตลาด ${name}`}
        onClick={() => {
          setOpen(true);
          setPreview(null);
          setConfirmation("");
          void run(async () => {
            setPreview(await call("GET", "/deletion"));
          });
        }}
      >
        <Trash2 data-icon="inline-start" />
        ลบ
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>ลบตลาด {name}</DialogTitle>
            <DialogDescription>
              ลบถาวรได้เฉพาะตลาดว่าง ไม่มีรอบ ประวัติ โซน ล็อก หรือร้านประจำ
              การปิดแสดงผลจะเก็บข้อมูลทั้งหมดไว้
            </DialogDescription>
          </DialogHeader>
          {!preview && !error && (
            <p role="status">กำลังตรวจสอบข้อมูลที่เกี่ยวข้อง…</p>
          )}
          {preview?.blockers.map((blocker) => (
            <p key={blocker}>{blocker}</p>
          ))}
          {preview?.canDelete ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`confirm-market-${id}`}>
                  กรอก {preview.name} เพื่อยืนยัน
                </FieldLabel>
                <Input
                  id={`confirm-market-${id}`}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || confirmation.trim() !== preview.name.trim()}
                onClick={() =>
                  void run(async () => {
                    await call("DELETE", "", { confirmName: confirmation });
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                ยืนยันลบตลาดถาวร
              </Button>
            </FieldGroup>
          ) : (
            preview && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await call("PATCH", "", { active: false });
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                ปิดแสดงผลแทน · เก็บประวัติ
              </Button>
            )
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
