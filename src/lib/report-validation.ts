import { z } from "zod";

export const reportMessages = {
  required: "กรุณาระบุปัญหาที่พบ",
  tooLong: "รายละเอียดปัญหาต้องไม่เกิน 2,000 ตัวอักษร",
  failed: "ส่งรายงานไม่สำเร็จ กรุณาลองอีกครั้ง",
  success: "ส่งรายงานเรียบร้อยแล้ว",
} as const;

// Shared by the report form and API; short Thai descriptions are meaningful too.
export const reportReasonSchema = z
  .string({ error: reportMessages.required })
  .trim()
  .min(1, { error: reportMessages.required })
  .max(2000, { error: reportMessages.tooLong });

export const reportSchema = z.object({
  productId: z.string({ error: reportMessages.failed }).min(1, { error: reportMessages.failed }),
  reason: reportReasonSchema,
});
