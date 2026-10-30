import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), end: vi.fn(), count: vi.fn(), generate: vi.fn(),
}));
vi.mock("pg", () => ({ Client: class { query = mocks.query; connect = mocks.connect; end = mocks.end; } }));
vi.mock("@/lib/db", () => ({ db: { demoBatch: { count: mocks.count } } }));
vi.mock("@/services/demo", () => ({ DemoService: { generate: mocks.generate } }));
import { seedDemoOnce } from "../../scripts/seed-demo-once";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db:5432/imtor_demo");
  vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("ENABLE_DEMO_GENERATOR", "true");
  mocks.query.mockResolvedValue({ rows: [{ name: "imtor_demo" }] });
  mocks.count.mockResolvedValue(0);
});
afterEach(() => vi.unstubAllEnvs());
it("serializes seed startup and preserves an existing demo batch", async () => {
  mocks.count.mockResolvedValue(1);
  await seedDemoOnce();
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.query.mock.calls.some(([q]) => q.includes("pg_advisory_lock"))).toBe(true);
  expect(mocks.end).toHaveBeenCalled();
});
it("generates only when no fictional batch exists", async () => {
  await seedDemoOnce();
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.generate).toHaveBeenCalledWith({}, "cli:demo-deployment");
});
it("rejects a production database before connecting", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db:5432/imtor");
  await expect(seedDemoOnce()).rejects.toThrow("isolated");
  expect(mocks.connect).not.toHaveBeenCalled();
});
it("closes the locking connection when generation fails", async () => {
  mocks.generate.mockRejectedValue(new Error("generation failed"));
  await expect(seedDemoOnce()).rejects.toThrow("generation failed");
  expect(mocks.end).toHaveBeenCalled();
});
