import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn() } }));
import { db } from "@/lib/db";
import { DemoService } from "@/services/demo";
afterEach(() => vi.unstubAllEnvs());
describe("fictional demo generation boundary", () => {
  it("rejects disabled generation before touching the database", async () => {
    vi.stubEnv("ENABLE_DEMO_GENERATOR", "false");
    await expect(DemoService.generate({}, "operator")).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("requires explicit production demo mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_DEMO_GENERATOR", "true");
    vi.stubEnv("DEMO_MODE", "false");
    await expect(DemoService.generate({}, "operator")).rejects.toThrow();
  });
  it("rejects destructive cleanup when disabled", async () => {
    vi.stubEnv("ENABLE_DEMO_GENERATOR", "false");
    await expect(DemoService.cleanup("batch", "operator")).rejects.toThrow();
  });
  it("rejects unbounded counts and unknown scenarios before transaction", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENABLE_DEMO_GENERATOR", "true");
    await expect(
      DemoService.generate({ products: 500001 }, "operator"),
    ).rejects.toThrow();
    await expect(
      DemoService.generate({ scenario: "not-a-scenario" }, "operator"),
    ).rejects.toThrow();
  });
});
