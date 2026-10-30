import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { assertActive, type Actor } from "@/lib/permissions";
const MAX = 5 * 1024 * 1024;
function client() {
  invariant(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_PUBLIC_BASE_URL,
    "ยังไม่ได้ตั้งค่าพื้นที่จัดเก็บรูปภาพ",
    503,
  );
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    // Browser PUT bytes are not available while signing; never sign an empty CRC.
    ...(process.env.S3_PROVIDER === "r2"
      ? {
          requestChecksumCalculation: "WHEN_REQUIRED" as const,
          responseChecksumValidation: "WHEN_REQUIRED" as const,
        }
      : {}),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}
export async function validateImage(bytes: Buffer) {
  invariant(bytes.length > 0 && bytes.length <= MAX, "รูปภาพต้องไม่เกิน 5 MB");
  const instance = sharp(bytes, {
    limitInputPixels: 24_000_000,
    failOn: "error",
  });
  const meta = await instance.metadata();
  invariant(
    ["jpeg", "png", "webp"].includes(meta.format ?? ""),
    "รองรับเฉพาะ JPEG, PNG, WebP",
  );
  invariant(!meta.pages || meta.pages === 1, "ไม่รองรับภาพเคลื่อนไหว");
  return instance
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
export class UploadService {
  static async authorize(actor: Actor, mime: string, size: number) {
    assertActive(actor);
    invariant(
      ["image/jpeg", "image/png", "image/webp"].includes(mime) &&
        Number.isInteger(size) &&
        size > 0 &&
        size <= MAX,
      "ไฟล์รูปภาพไม่ถูกต้อง",
    );
    const s3 = client();
    const key = `staging/${actor.id}/${randomUUID()}`;
    const row = await db.upload.create({
      data: { userId: actor.id, key, mime, size },
    });
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: mime,
        ContentLength: size,
      }),
      { expiresIn: 120 },
    );
    return { id: row.id, url };
  }
  static async finalize(actor: Actor, id: string) {
    assertActive(actor);
    const row = await db.upload.findUniqueOrThrow({ where: { id } });
    invariant(row.userId === actor.id, "ไม่มีสิทธิ์ใช้รูปนี้", 403);
    if (row.status === "APPROVED" && row.approvedKey)
      return { imageUrl: this.publicUrl(row.approvedKey) };
    invariant(
      Date.now() - row.createdAt.getTime() < 10 * 60000,
      "การอัปโหลดหมดอายุ กรุณาเลือกไฟล์อีกครั้ง",
      409,
    );
    const s3 = client();
    const object = { Bucket: process.env.S3_BUCKET, Key: row.key };
    const head = await s3.send(new HeadObjectCommand(object));
    invariant(
      head.ContentLength &&
        head.ContentLength <= MAX &&
        head.ContentLength === row.size,
      "ขนาดไฟล์ไม่ตรงกัน",
    );
    const response = await s3.send(
      new GetObjectCommand({ ...object, IfMatch: head.ETag }),
    );
    invariant(response.Body, "ไม่พบไฟล์");
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      length += chunk.length;
      invariant(length <= MAX, "ไฟล์ใหญ่เกินไป");
      chunks.push(Buffer.from(chunk));
    }
    const safe = await validateImage(Buffer.concat(chunks));
    const approvedKey = `approved/${actor.id}/${randomUUID()}.jpg`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: approvedKey,
        Body: safe,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    await db.upload.update({
      where: { id },
      data: { approvedKey, status: "APPROVED" },
    });
    await s3.send(new DeleteObjectCommand(object));
    return { imageUrl: this.publicUrl(approvedKey) };
  }
  static publicUrl(key: string) {
    return `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "")}/${key}`;
  }
  static async assertOwned(actor: Actor, url: string) {
    if (url.startsWith("/images/")) {
      invariant(
        /^\/images\/[a-z0-9-]+\.(jpg|png|webp)$/.test(url),
        "รูปภาพไม่ถูกต้อง",
      );
      return;
    }
    const prefix = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") + "/";
    invariant(prefix && url.startsWith(prefix), "ต้องอัปโหลดรูปภาพผ่าน ImTor");
    const upload = await db.upload.findFirst({
      where: {
        userId: actor.id,
        approvedKey: url.slice(prefix.length),
        status: "APPROVED",
      },
    });
    invariant(upload, "รูปภาพยังไม่ผ่านการตรวจสอบหรือไม่ใช่ของคุณ", 403);
  }
}
