import { it, expect } from "vitest";
import sharp from "sharp";
import { validateImage } from "@/services/uploads";
it("rejects scripts disguised as photographs", async () => {
  await expect(
    validateImage(Buffer.from("<script>alert(1)</script>")),
  ).rejects.toThrow();
});
it("decodes and rewrites valid bytes into a safe JPEG", async () => {
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const out = await validateImage(png);
  expect((await sharp(out).metadata()).format).toBe("jpeg");
});
