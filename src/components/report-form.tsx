"use client";

import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { request } from "@/lib/api-request";
import { reportMessages, reportReasonSchema } from "@/lib/report-validation";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";

export function ReportForm({ productId }: { productId: string }) {
  const id = useId();
  const hydrated = useHydrated();
  const lock = useRef(false);
  const [failure, setFailure] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ reason: string }>({ defaultValues: { reason: "" } });

  return (
    <form
      noValidate
      aria-busy={isSubmitting}
      onSubmit={(event) => {
        void handleSubmit(async ({ reason }) => {
          if (lock.current) return;
          lock.current = true;
          setFailure("");
          try {
            await request("/api/reports", "POST", {
              productId,
              reason: reportReasonSchema.parse(reason),
            });
            reset();
            toast.success(reportMessages.success, { id: `report:${productId}` });
          } catch {
            // Never render arbitrary API/schema/debug text in this public-facing form.
            setFailure(reportMessages.failed);
          } finally {
            lock.current = false;
          }
        })(event);
      }}
    >
      <fieldset disabled={!hydrated || isSubmitting} className="min-w-0 border-0 p-0">
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor={`${id}-reason`}>รายละเอียดปัญหา</FieldLabel>
          <Textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={2000}
            aria-required="true"
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? `${id}-error` : undefined}
            {...register("reason", {
              validate: (value) => {
                const parsed = reportReasonSchema.safeParse(value);
                return parsed.success || parsed.error.issues[0].message;
              },
            })}
          />
          {errors.reason && (
            <p id={`${id}-error`} className="form-error" role="alert">
              {errors.reason.message}
            </p>
          )}
        </Field>
        {failure && (
          <p className="form-error mt-3" role="alert">{failure}</p>
        )}
        <div className="form-actions">
          <Button type="submit" disabled={!hydrated || isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting && <LoaderCircle className="motion-spinner" aria-hidden="true" />}
            {isSubmitting ? "กำลังส่งรายงาน…" : "ส่งรายงาน"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
