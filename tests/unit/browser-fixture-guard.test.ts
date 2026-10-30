import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
it("rejects a non-test database before browser fixture writes", () => {
  const result = spawnSync("bun", ["scripts/test-fixtures.ts"], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/imtor",
    },
    timeout: 10000,
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Isolated local tests only");
});
