"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import Link, { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span className="navigation-pending" data-pending={pending || undefined}>
      <LoaderCircle aria-hidden="true" />
      <span className="sr-only" role="status">
        {pending ? "กำลังโหลดข้อมูล" : ""}
      </span>
    </span>
  );
}

export function NavigationLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cn("pending-link", className)}>
      {children}
      <LinkPending />
    </Link>
  );
}

export function FormSubmit({
  label = "ค้นหา",
  pendingLabel = "กำลังค้นหา",
}: {
  label?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="form-submit"
    >
      <span
        aria-hidden={pending || undefined}
        className={pending ? "opacity-0" : undefined}
      >
        {label}
      </span>
      {pending && (
        <>
          <span className="form-submit-spinner" aria-hidden="true">
            <LoaderCircle className="motion-spinner" />
          </span>
          <span className="sr-only" role="status">
            {pendingLabel}
          </span>
        </>
      )}
    </Button>
  );
}
