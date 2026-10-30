import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateProductionEnv } from "./production-env.mjs";

export function createDemoEnv(source) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const key of ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "ADMIN_EMAILS"])
    env[key] = source[key] ?? "";
  Object.assign(env, {
    NODE_ENV: "production", APP_NAME: "ImTor", APP_DOMAIN: "imtor.applely.dev",
    APP_URL: "https://imtor.applely.dev", NEXTAUTH_URL: "https://imtor.applely.dev",
    AUTH_SECRET: randomBytes(32).toString("hex"), TZ: "Asia/Bangkok",
    POSTGRES_DB: "imtor_demo", POSTGRES_USER: "imtor_demo",
    POSTGRES_PASSWORD: randomBytes(32).toString("hex"),
    S3_PROVIDER: "r2", S3_REGION: "auto", S3_BUCKET: "imtor-images",
    S3_ENDPOINT: "https://321ebeff48e3571359ce7cc64288e56b.r2.cloudflarestorage.com",
    S3_PUBLIC_BASE_URL: "https://media.imtor.applely.dev", S3_FORCE_PATH_STYLE: "false",
    MAX_UPLOAD_MB: "5", DEMO_MODE: "true", ENABLE_DEMO_GENERATOR: "true",
    IMTOR_PROJECT_NAME: "imtor-demo", IMTOR_EDGE_NETWORK: "imtor-edge",
    IMTOR_INTERNAL_NETWORK: "imtor-demo-internal", CLOUDFLARE_CONNECTOR: "busy_ishizaka",
    BACKUP_DIRECTORY: "/var/backups/imtor-demo", BACKUP_RETENTION_DAYS: "7",
  });
  env.DATABASE_URL = `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@db:5432/${env.POSTGRES_DB}?schema=public`;
  return env;
}

export function validateDemoEnv(env) {
  // Reuse every provider/database/HTTPS check without relaxing the production gate.
  const errors = validateProductionEnv({ ...env, DEMO_MODE: "false", ENABLE_DEMO_GENERATOR: "false" }, "tunnel");
  for (const [key, value] of Object.entries({
    POSTGRES_DB: "imtor_demo", IMTOR_PROJECT_NAME: "imtor-demo",
    IMTOR_INTERNAL_NETWORK: "imtor-demo-internal", IMTOR_EDGE_NETWORK: "imtor-edge",
    DEMO_MODE: "true", ENABLE_DEMO_GENERATOR: "true",
  })) if (env[key] !== value) errors.push(`${key}: isolated demo value required`);
  const emails = (env.ADMIN_EMAILS ?? "").split(",").map(v => v.trim());
  if (!emails.length || emails.some(v => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v) || /@(?:example\.(?:com|org|net)|[^@]*\.invalid)$|REPLACE|YOUR_/i.test(v)))
    errors.push("ADMIN_EMAILS: intended real presenter identity required");
  return errors;
}

function readPrivateEnv(file) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.mode & 0o077) throw new Error("Environment must be a regular mode-600 file.");
  return parseEnv(readFileSync(file, "utf8"));
}

export function initializeDemoEnv(from, to) {
  if (existsSync(to)) return readPrivateEnv(to);
  const env = createDemoEnv(readPrivateEnv(from));
  const errors = validateDemoEnv(env);
  if (errors.length) throw new Error(errors.join("\n"));
  const lines = Object.entries(env).map(([key, value]) => {
    if (/[\r\n']/.test(value)) throw new Error(`${key}: unsupported environment quoting; configure privately`);
    return `${key}='${value}'`;
  });
  writeFileSync(to, lines.join("\n") + "\n", { flag: "wx", mode: 0o600 });
  return env;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2] ?? ".env.deployment";
    const env = process.argv.includes("--init")
      ? initializeDemoEnv(".env.production", file) : readPrivateEnv(file);
    const errors = validateDemoEnv(env);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Isolated demo configuration passed; Google login and public media still require live verification.");
  } catch (error) {
    console.error(error.code ? "Cannot access private demo environment file." : error.message);
    process.exitCode = 1;
  }
}
