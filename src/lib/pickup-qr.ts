import { z } from 'zod';
const pickupQrSchema = z.object({
  type: z.literal('imtor.pickup'),
  v: z.literal(1),
  id: z.string().min(1).max(100),
  code: z.string().min(1).max(100),
}).strict();
export function createPickupQr(id: string, code: string) {
  return JSON.stringify(pickupQrSchema.parse({ type: 'imtor.pickup', v: 1, id, code }));
}
export function parsePickupQr(value: string) {
  if (typeof value !== 'string' || value.length > 1024) throw new Error('QR นี้ไม่ใช่รหัสรับสินค้าของอิ่มต่อ');
  try { return pickupQrSchema.parse(JSON.parse(value)); }
  catch { throw new Error('QR นี้ไม่ใช่รหัสรับสินค้าของอิ่มต่อ'); }
}
