import { beforeEach, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $queryRaw: query } }));
import { GET as live } from "@/app/api/health/live/route";
import { GET as ready } from "@/app/api/health/ready/route";
beforeEach(() => query.mockReset());
it("liveness does not touch the database", async () => {
  const response = await live();
  expect(response.status).toBe(200);
  expect(query).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("readiness requires database connectivity", async () => {
  query.mockResolvedValueOnce([{ "?column?": 1 }]);
  expect((await ready()).status).toBe(200);
  query.mockRejectedValueOnce(
    new Error("postgresql://private:secret@db/imtor"),
  );
  const response = await ready();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
