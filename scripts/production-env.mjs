import { readFileSync, statSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Validate values without including credentials or URLs with credentials in errors. */
export function validateProductionEnv(env, mode = "tunnel") {
  const errors = [];
  const required = [
    "NODE_ENV",
    "APP_DOMAIN",
    "APP_URL",
    "NEXTAUTH_URL",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "S3_PROVIDER",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_PUBLIC_BASE_URL",
  ];
  for (const key of required)
    if (!env[key] || /REPLACE|YOUR_|replace-with/i.test(env[key]))
      errors.push(`${key}: required non-placeholder value`);
  const httpsOrigin = (value) => {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        u.pathname === "/"
      );
    } catch {
      return false;
    }
  };
  if (env.NODE_ENV !== "production")
    errors.push("NODE_ENV: must be production");
  if (!httpsOrigin(env.APP_URL) || env.APP_URL !== env.NEXTAUTH_URL)
    errors.push(
      "APP_URL/NEXTAUTH_URL: matching HTTPS origins required (NextAuth v4)",
    );
  try {
    if (new URL(env.APP_URL).hostname !== env.APP_DOMAIN)
      errors.push("APP_DOMAIN: must match APP_URL hostname");
  } catch {
    /* Reported above. */
  }
  if (mode === "tunnel" && env.APP_URL !== "https://imtor.applely.dev")
    errors.push("APP_URL: expected ImTor production origin in tunnel mode");
  if ((env.AUTH_SECRET?.length ?? 0) < 32)
    errors.push("AUTH_SECRET: minimum 32 characters");
  if (!env.AUTH_GOOGLE_ID?.endsWith(".apps.googleusercontent.com"))
    errors.push("AUTH_GOOGLE_ID: Google Web client ID required");
  if ((env.AUTH_GOOGLE_SECRET?.length ?? 0) < 20)
    errors.push("AUTH_GOOGLE_SECRET: missing replacement credential");
  if ((env.POSTGRES_PASSWORD?.length ?? 0) < 24)
    errors.push("POSTGRES_PASSWORD: minimum 24 characters");
  try {
    const u = new URL(env.DATABASE_URL);
    if (
      !["postgres:", "postgresql:"].includes(u.protocol) ||
      u.hostname !== "db" ||
      (u.port && u.port !== "5432") ||
      decodeURIComponent(u.username) !== env.POSTGRES_USER ||
      decodeURIComponent(u.password) !== env.POSTGRES_PASSWORD ||
      decodeURIComponent(u.pathname.slice(1)) !== env.POSTGRES_DB
    )
      errors.push(
        "DATABASE_URL: expected db:5432 with matching encoded user/password/database",
      );
  } catch {
    errors.push("DATABASE_URL: invalid PostgreSQL URL");
  }
  if (env.S3_PROVIDER !== "r2" || env.S3_REGION !== "auto")
    errors.push("S3_PROVIDER/S3_REGION: r2 and auto required");
  if (!httpsOrigin(env.S3_ENDPOINT))
    errors.push("S3_ENDPOINT: HTTPS origin required");
  if (
    mode === "tunnel" &&
    (env.S3_ENDPOINT !==
      "https://321ebeff48e3571359ce7cc64288e56b.r2.cloudflarestorage.com" ||
      env.S3_BUCKET !== "imtor-images")
  )
    errors.push(
      "S3_ENDPOINT/S3_BUCKET: expected existing ImTor R2 account and bucket",
    );
  if (
    !httpsOrigin(env.S3_PUBLIC_BASE_URL) ||
    env.S3_PUBLIC_BASE_URL === env.S3_ENDPOINT
  )
    errors.push(
      "S3_PUBLIC_BASE_URL: verified public HTTPS media origin required, not the S3 API endpoint",
    );
  if (env.MAX_UPLOAD_MB !== "5")
    errors.push(
      "MAX_UPLOAD_MB: existing application enforces 5 MB; preserve that limit",
    );
  if (env.DEMO_MODE !== "false" || env.ENABLE_DEMO_GENERATOR !== "false")
    errors.push(
      "DEMO_MODE/ENABLE_DEMO_GENERATOR: disable production demo generation",
    );
  if (!/^[1-9][0-9]*$/.test(env.BACKUP_RETENTION_DAYS ?? ""))
    errors.push("BACKUP_RETENTION_DAYS: positive integer required");
  return [...new Set(errors)];
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const file = process.argv[2] ?? ".env.production";
    if (statSync(file).mode & 0o077)
      throw new Error(
        "Environment file must have mode 600 (no group/other access).",
      );
    const errors = validateProductionEnv(
      parseEnv(readFileSync(file, "utf8")),
      process.argv[3] ?? "tunnel",
    );
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else
      console.log(
        "Production environment structural validation passed; live rotation/domain/integration checks remain separate.",
      );
  } catch (error) {
    console.error(
      error.code ? "Cannot read production environment file." : error.message,
    );
    process.exitCode = 1;
  }
}
