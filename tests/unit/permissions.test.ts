import { describe, it, expect } from "vitest";
import { assertOwner, assertAdmin } from "@/lib/permissions";
describe("server permissions", () => {
  const user = { id: "one", role: "USER", suspended: false };
  it("rejects a different store owner", () =>
    expect(() => assertOwner(user, { ownerId: "two" })).toThrow("ไม่มีสิทธิ์"));
  it("allows ownership but not admin actions", () => {
    expect(() => assertOwner(user, { ownerId: "one" })).not.toThrow();
    expect(() => assertAdmin(user)).toThrow();
  });
  it("suspension revokes admin privileges", () =>
    expect(() =>
      assertAdmin({ ...user, role: "ADMIN", suspended: true }),
    ).toThrow());
});
