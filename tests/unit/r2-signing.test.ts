import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({
  db: { upload: { create: vi.fn().mockResolvedValue({ id: "test-upload" }) } },
}));
import { UploadService } from "@/services/uploads";
afterEach(() => vi.unstubAllEnvs());
it("does not sign an empty-body checksum into the URL for a later browser PUT", async () => {
  for (const [key, value] of Object.entries({
    S3_PROVIDER: "r2",
    S3_ENDPOINT:
      "https://321ebeff48e3571359ce7cc64288e56b.r2.cloudflarestorage.com",
    S3_REGION: "auto",
    S3_BUCKET: "imtor-images",
    S3_PUBLIC_BASE_URL: "https://media.imtor.applely.dev",
    S3_ACCESS_KEY_ID: "test-key",
    S3_SECRET_ACCESS_KEY: "test-secret",
  }))
    vi.stubEnv(key, value);
  const result = await UploadService.authorize(
    { id: "test-merchant", role: "USER", suspended: false },
    "image/jpeg",
    200,
  );
  const url = new URL(result.url);
  expect(url.hostname).toContain("r2.cloudflarestorage.com");
  expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
  expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
});
