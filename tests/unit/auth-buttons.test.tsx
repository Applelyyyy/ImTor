import { readFileSync } from "node:fs";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signIn, signOut } = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn, signOut }));
import { LoginButton, LogoutButton } from "@/components/auth-buttons";

function action(node: ReactNode): { onClick: () => void; disabled?: boolean } {
  if (isValidElement<{ onClick?: () => void; disabled?: boolean; children?: ReactNode }>(node)) {
    if (node.props.onClick) return node.props as { onClick: () => void; disabled?: boolean };
    return action(node.props.children);
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      try { return action(child); } catch { /* Continue to the next rendered child. */ }
    }
  }
  throw new Error("No button action in the rendered component");
}

describe("isolated authentication buttons", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps Google sign-in and its profile callback unchanged", () => {
    const button = LoginButton({});
    expect(renderToStaticMarkup(button)).toContain("เข้าสู่ระบบด้วย Google");
    expect(action(button).disabled).toBe(false);
    action(button).onClick();
    expect(signIn).toHaveBeenCalledExactlyOnceWith("google", { callbackUrl: "/profile" });
    expect(signOut).not.toHaveBeenCalled();
  });
  it("keeps the unavailable-provider state disabled", () => {
    const button = LoginButton({ enabled: false });
    expect(action(button).disabled).toBe(true);
    expect(renderToStaticMarkup(button)).toContain("disabled");
    expect(signIn).not.toHaveBeenCalled();
  });
  it("keeps logout and its home callback unchanged", () => {
    const button = LogoutButton();
    expect(renderToStaticMarkup(button)).toContain("ออกจากระบบ");
    action(button).onClick();
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ callbackUrl: "/" });
  });
  it("does not pull authentication into generic forms or lose its page callers", () => {
    const forms = readFileSync("src/components/forms.tsx", "utf8");
    expect(forms).not.toContain("next-auth");
    expect(forms).not.toMatch(/export function (LoginButton|LogoutButton)/);
    for (const route of ["login", "profile", "become-vendor"]) {
      expect(readFileSync(`src/app/${route}/page.tsx`, "utf8")).toContain('@/components/auth-buttons');
    }
  });
});
