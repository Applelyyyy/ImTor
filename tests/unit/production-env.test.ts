import { describe, expect, it } from "vitest";
import { validateProductionEnv } from "../../scripts/production-env.mjs";
const valid = {
  NODE_ENV: "production",
  APP_DOMAIN: "imtor.applely.dev",
  APP_URL: "https://imtor.applely.dev",
  NEXTAUTH_URL: "https://imtor.applely.dev",
  POSTGRES_USER: "imtor",
  POSTGRES_DB: "imtor",
  POSTGRES_PASSWORD: "test-strong-password-$!12345678",
  DATABASE_URL:
    "postgresql://imtor:test-strong-password-%24!12345678@db:5432/imtor?schema=public",
  AUTH_SECRET: "a".repeat(64),
  AUTH_GOOGLE_ID: "test.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "test-google-secret-not-a-real-credential",
  S3_PROVIDER: "r2",
  S3_ENDPOINT:
    "https://321ebeff48e3571359ce7cc64288e56b.r2.cloudflarestorage.com",
  S3_REGION: "auto",
  S3_BUCKET: "imtor-images",
  S3_ACCESS_KEY_ID: "test-key-not-a-real-credential",
  S3_SECRET_ACCESS_KEY: "test-secret-not-a-real-credential",
  S3_PUBLIC_BASE_URL: "https://media.imtor.applely.dev",
  MAX_UPLOAD_MB: "5",
  DEMO_MODE: "false",
  ENABLE_DEMO_GENERATOR: "false",
  BACKUP_RETENTION_DAYS: "7",
};
describe("production preflight", () => {
  it("accepts the actual v4 origin and encoded matching database password", () =>
    expect(validateProductionEnv(valid, "tunnel")).toEqual([]));
  it.each([
    { NEXTAUTH_URL: "http://app:3000" },
    { DATABASE_URL: valid.DATABASE_URL.replace("@db:", "@localhost:") },
    { POSTGRES_PASSWORD: "different-password-123456789" },
    { AUTH_GOOGLE_SECRET: "REPLACE_WITH_NEW_GOOGLE_SECRET" },
    { S3_PUBLIC_BASE_URL: "" },
    { S3_PUBLIC_BASE_URL: "https://media.imtor.applely.dev?token=secret" },
    { S3_PUBLIC_BASE_URL: valid.S3_ENDPOINT },
    { ENABLE_DEMO_GENERATOR: "true" },
    { MAX_UPLOAD_MB: "8" },
  ])(
    "rejects incomplete or mismatched settings without echoing values",
    (override) => {
      const errors = validateProductionEnv({ ...valid, ...override }, "tunnel");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(" ")).not.toContain("token=secret");
      expect(errors.join(" ")).not.toContain(valid.AUTH_SECRET);
    },
  );
});
