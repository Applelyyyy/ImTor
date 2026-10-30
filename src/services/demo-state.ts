import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";

const schema = z.object({
  stores: z.number().int().min(1).max(100).default(30),
  products: z.number().int().min(1).max(1000).default(150),
  customers: z.number().int().min(1).max(500).default(100),
  reservations: z.number().int().min(0).max(3000).default(250),
  historyDays: z.number().int().min(1).max(90).default(21),
  futureDays: z.number().int().min(1).max(90).default(14),
  markets: z.number().int().min(1).max(8).default(2),
  zones: z.number().int().min(1).max(64).default(8),
  stalls: z.number().int().min(1).max(500).default(80),
  seed: z.string().trim().min(1).max(96).default("imtor-realistic-v1"),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/).default(() => randomUUID()),
  visitorReservations: z.boolean().default(true),
  useImages: z.boolean().default(true),
}).strict().superRefine((value, ctx) => {
  if (value.zones < value.markets || value.stalls < value.zones)
    ctx.addIssue({ code: "custom", message: "Each market needs a zone and each zone a stall" });
  if (value.stalls < value.stores)
    ctx.addIssue({ code: "custom", message: "Provide at least one stall per store" });
});
export type DemoConfig = z.infer<typeof schema>;
export function parseDemoConfig(input: unknown = {}): DemoConfig {
  const result = schema.safeParse(input);
  invariant(result.success, result.success ? "" : result.error.issues.map((issue) => issue.message).join("; "));
  return result.data;
}
export type DemoAsset = { key: string; url: string; sha256: string; bytes: number };
export type DemoState = {
  batchId: string;
  config: DemoConfig;
  asOf: string;
  stage: "MEDIA" | "DATA" | "VALIDATE" | "READY" | "ERROR" | "CLEANING" | "REMOVED";
  message: string;
  assets: Record<string, DemoAsset>;
  error?: string;
};
export function demoStateKey(batchId: string): string {
  invariant(/^[a-zA-Z0-9_-]{1,100}$/.test(batchId), "Invalid demo batch ID");
  return `demo:${batchId}`;
}
export function stateJson(state: DemoState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}
export async function loadDemoState(batchId: string): Promise<DemoState | null> {
  const row = await db.systemSetting.findUnique({ where: { key: demoStateKey(batchId) } });
  if (!row) return null;
  const value = row.value as unknown as DemoState;
  invariant(value.batchId === batchId && Number.isFinite(Date.parse(value.asOf)), "Invalid persisted demo state", 500);
  parseDemoConfig(value.config);
  return value;
}
export async function saveDemoState(state: DemoState): Promise<void> {
  const key = demoStateKey(state.batchId);
  parseDemoConfig(state.config);
  invariant(Number.isFinite(Date.parse(state.asOf)), "Invalid demo clock");
  await db.systemSetting.upsert({ where: { key }, create: { key, value: stateJson(state) }, update: { value: stateJson(state) } });
}
