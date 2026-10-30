import { expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createDemoEnv } from "../../scripts/demo-env.mjs";

it("refuses unowned volumes/networks or a foreign Tunnel alias before building", () => {
  const dir = mkdtempSync(join(tmpdir(), "imtor-demo-guard-"));
  try {
    const env = createDemoEnv({
      AUTH_GOOGLE_ID: "test.apps.googleusercontent.com", AUTH_GOOGLE_SECRET: "test-google-secret-not-real",
      S3_ACCESS_KEY_ID: "test-key", S3_SECRET_ACCESS_KEY: "test-secret", ADMIN_EMAILS: "presenter@university.ac.th",
    });
    const file = join(dir, "demo.env"), marker = join(dir, "built");
    writeFileSync(file, Object.entries(env).map(([k, v]) => `${k}='${v}'`).join("\n"), { mode: 0o600 });
    writeFileSync(join(dir, "docker"), String.raw`#!/bin/bash
[[ -z "$DATABASE_URL$POSTGRES_DB$POSTGRES_PASSWORD$IMTOR_INTERNAL_NETWORK$S3_PUBLIC_BASE_URL" ]] || exit 98
case "$*" in
 *compose*config*--quiet*) exit 0;;
 *compose.service=caddy*|*compose.service=db*) exit 0;;
 *volume\ inspect\ imtor-demo_postgres_data*)
   [[ "$CASE" == volume ]] || exit 1
   [[ "$*" != *--format* ]] || echo 'unowned postgres_data';;
 *network\ inspect\ imtor-demo-internal*)
   [[ "$CASE" == network ]] || exit 1
   [[ "$*" != *--format* ]] || echo 'unowned true';;
 *network\ inspect\ imtor-edge*)
   [[ "$*" != *--format* ]] || echo foreign-container;;
 *inspect\ foreign-container*Aliases*) echo imtor-app;;
 *inspect\ foreign-container*) echo 'another-project app';;
 *build*) touch "$MARKER"; exit 90;;
 *) exit 99;;
esac
`, { mode: 0o700 });
    for (const name of ["volume", "network", "alias"]) {
      const result = spawnSync("bash", ["scripts/deploy-demo.sh"], {
        cwd: resolve("."), encoding: "utf8",
        env: { NODE_ENV: "test", PATH: `${dir}:${process.env.PATH}`, IMTOR_ENV_FILE: file,
          IMAGE_TAG: "demo-test", CASE: name, MARKER: marker,
          DATABASE_URL: "postgresql://wrong:wrong@db:5432/imtor", POSTGRES_DB: "imtor",
          POSTGRES_PASSWORD: "wrong-host-password", IMTOR_INTERNAL_NETWORK: "imtor-internal",
          S3_PUBLIC_BASE_URL: "https://wrong-host.example.org" },
      });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain("nothing changed");
      expect(existsSync(marker)).toBe(false);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
