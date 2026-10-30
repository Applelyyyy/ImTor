import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { AppError, invariant } from "./errors";
export function success(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: { message: error.message } },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: {
          message: error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; "),
        },
      },
      { status: 400 },
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025")
      return NextResponse.json(
        { error: { message: "ไม่พบข้อมูล" } },
        { status: 404 },
      );
    if (["P2002", "P2003", "P2004", "P2034"].includes(error.code))
      return NextResponse.json(
        { error: { message: "ข้อมูลขัดแย้ง กรุณาตรวจสอบและลองอีกครั้ง" } },
        { status: 409 },
      );
  }
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: { message: "ระบบขัดข้อง กรุณาลองอีกครั้ง" } },
    { status: 500 },
  );
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(
    process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3100",
  ).origin;
  invariant(origin === expected, "แหล่งที่มาของคำขอไม่ถูกต้อง", 403);
  invariant(
    request.headers.get("sec-fetch-site") !== "cross-site",
    "ไม่รองรับคำขอข้ามเว็บไซต์",
    403,
  );
}
export async function jsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  invariant(
    (request.headers.get("content-type") ?? "").includes("application/json"),
    "ต้องส่งข้อมูล JSON",
    415,
  );
  const reader = request.body?.getReader();
  invariant(reader, "ไม่มีข้อมูล");
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 64 * 1024) {
      await reader.cancel();
      throw new AppError(413, "ข้อมูลใหญ่เกินไป");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try {
    const value = JSON.parse(text);
    invariant(
      value && typeof value === "object" && !Array.isArray(value),
      "ข้อมูล JSON ไม่ถูกต้อง",
    );
    return value;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "ข้อมูล JSON ไม่ถูกต้อง");
  }
}
export async function rateLimit(key: string, limit = 120, seconds = 60) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const row = await db.rateLimit.upsert({
    where: { key: `${key}:${bucket}` },
    create: {
      key: `${key}:${bucket}`,
      expiresAt: new Date((bucket + 1) * seconds * 1000),
    },
    update: { count: { increment: 1 } },
  });
  invariant(row.count <= limit, "คำขอมากเกินไป กรุณารอสักครู่", 429);
  // Expired buckets are bounded by traffic, not retained as analytics.
  if (row.count === 1)
    await db.rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - seconds * 1000) } },
    });
}
