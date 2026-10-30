import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDemoEnv, initializeDemoEnv, validateDemoEnv } from "../../scripts/demo-env.mjs";
import { validateProductionEnv } from "../../scripts/production-env.mjs";

const source = {
  AUTH_GOOGLE_ID: "test.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "test-google-secret-not-a-real-credential",
  S3_ACCESS_KEY_ID: "test-key-not-a-real-credential",
  S3_SECRET_ACCESS_KEY: "test-secret-not-a-real-credential",
  ADMIN_EMAILS: "presenter@university.ac.th",
  AUTH_SECRET: "old-secret-must-not-be-reused",
  POSTGRES_PASSWORD: "old-password-must-not-be-reused",
};

describe("isolated full-demo deployment", () => {
  it("uses the same .env.deployment default in the CLI and launcher", () => {
    expect(readFileSync("scripts/demo-env.mjs", "utf8")).toContain('process.argv[2] ?? ".env.deployment"');
    expect(readFileSync("scripts/deploy-demo.sh", "utf8")).toContain('IMTOR_ENV_FILE:-.env.deployment');
  });
  it("reuses providers but generates separate app/database secrets and identities", () => {
    const env = createDemoEnv(source);
    expect(validateDemoEnv(env)).toEqual([]);
    expect(env.AUTH_GOOGLE_SECRET).toBe(source.AUTH_GOOGLE_SECRET);
    expect(env.S3_SECRET_ACCESS_KEY).toBe(source.S3_SECRET_ACCESS_KEY);
    expect(env.AUTH_SECRET).not.toBe(source.AUTH_SECRET);
    expect(env.POSTGRES_PASSWORD).not.toBe(source.POSTGRES_PASSWORD);
    expect(env.POSTGRES_DB).toBe("imtor_demo");
    expect(env.IMTOR_PROJECT_NAME).toBe("imtor-demo");
    expect(env.IMTOR_INTERNAL_NETWORK).toBe("imtor-demo-internal");
    expect(validateProductionEnv(env, "tunnel").join(" ")).toContain("disable production demo generation");
  });

  it.each<Record<string, string>>([
    { POSTGRES_DB: "imtor" },
    { IMTOR_PROJECT_NAME: "imtor" },
    { IMTOR_INTERNAL_NETWORK: "imtor-internal" },
    { IMTOR_EDGE_NETWORK: "bridge" },
    { DEMO_MODE: "false" },
    { ENABLE_DEMO_GENERATOR: "false" },
    { ADMIN_EMAILS: "" },
    { ADMIN_EMAILS: "admin@example.com" },
    { ADMIN_EMAILS: "sample@demo.invalid" },
    { NEXTAUTH_URL: "http://localhost:3100" },
    { S3_SECRET_ACCESS_KEY: "REPLACE_THIS" },
  ])("rejects unsafe or incomplete demo configuration", (override) => {
    const env: Record<string, string> = { ...createDemoEnv(source), ...override };
    const errors = validateDemoEnv(env);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).not.toContain(env.AUTH_SECRET);
    expect(errors.join(" ")).not.toContain(source.AUTH_GOOGLE_SECRET);
  });

  it("creates an ignored-style private env once, preserving every byte on a rerun", () => {
    const dir = mkdtempSync(join(tmpdir(), "imtor-demo-env-"));
    try {
      const from = join(dir, "source.env"), to = join(dir, "demo.env");
      writeFileSync(from, Object.entries(source).map(([k, v]) => `${k}='${v}'`).join("\n"), { mode: 0o600 });
      initializeDemoEnv(from, to);
      const original = readFileSync(to, "utf8");
      expect(statSync(to).mode & 0o777).toBe(0o600);
      initializeDemoEnv(from, to);
      expect(readFileSync(to, "utf8")).toBe(original);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
