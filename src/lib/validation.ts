import { z } from "zod";
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(160);
const money = z.number().int().min(0).max(100_000_000);
export const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "ใช้เวลา HH:mm");
export const date = z.iso.date();
const instant = z.iso.datetime({ offset: true });
const image = z
  .string()
  .max(2048)
  .refine(
    (v) => v.startsWith("/images/") || /^https?:\/\//.test(v),
    "รูปภาพไม่ถูกต้อง",
  );
export const storeSchema = z
  .object({
    name: text,
    description: z.string().max(2000).default(""),
    kind: z.enum(["MARKET", "PERMANENT", "BOTH"]).default("MARKET"),
    address: z.string().max(500).optional(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    imageUrl: image.optional(),
  })
  .refine((s) => s.kind === "MARKET" || !!s.address, "กรุณาระบุที่อยู่ร้าน");
export const productFields = z.object({
  storeId: id,
  name: text,
  description: z.string().max(4000).default(""),
  imageUrl: image,
  price: money,
  categoryId: id,
  mode: z.enum(["REGULAR", "DISCOUNT", "RESCUE"]).default("REGULAR"),
  published: z.boolean().default(true),
  archived: z.boolean().default(false),
  reservable: z.boolean().default(false),
  stock: z.number().int().min(0).max(1_000_000).nullish(),
  sessionId: id.nullish(),
  pickupStart: instant.nullish(),
  pickupEnd: instant.nullish(),
  allergens: z.string().max(1000).nullish(),
  storage: z.string().max(1000).nullish(),
});
export function validateProduct(p: z.infer<typeof productFields>) {
  return (
    !p.reservable ||
    (p.stock != null &&
      !!p.pickupStart &&
      !!p.pickupEnd &&
      new Date(p.pickupEnd) > new Date(p.pickupStart))
  );
}
export const productSchema = productFields
  .refine(validateProduct, "การจองต้องมีจำนวนสินค้าและเวลารับที่ถูกต้อง")
  .refine(
    (p) =>
      p.mode !== "RESCUE" || (!!p.allergens && !!p.storage && !!p.pickupEnd),
    "สินค้าช่วยลดอาหารเหลือทิ้งต้องมีข้อมูลแพ้อาหาร การเก็บ และเวลารับ",
  );
export const discountSchema = z
  .object({
    kind: z.enum(["FIXED", "PERCENT_OFF", "FINAL_PERCENT"]),
    value: money,
    startsAt: instant,
    endsAt: instant,
    repeatStart: time.nullish(),
    repeatEnd: time.nullish(),
    timezone: z.string().default("Asia/Bangkok"),
    priority: z.number().int().min(-100).max(100).default(0),
  })
  .refine(
    (r) => r.kind === "FIXED" || r.value <= 100,
    "เปอร์เซ็นต์ต้องไม่เกิน 100",
  )
  .refine(
    (r) => new Date(r.endsAt) > new Date(r.startsAt),
    "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
  )
  .refine(
    (r) => !!r.repeatStart === !!r.repeatEnd,
    "ต้องระบุช่วงเวลาซ้ำทั้งสองค่า",
  )
  .refine(
    (r) => !r.repeatStart || r.repeatStart !== r.repeatEnd,
    "เวลาเริ่มและสิ้นสุดช่วงซ้ำต้องต่างกัน",
  );
export const attendanceSchema = z.object({
  storeId: id,
  sessionId: id,
  stallId: id,
  authorized: z.literal(true),
  status: z
    .enum(["SCHEDULED", "OPEN", "CLOSED", "CANCELLED", "NOT_ATTENDING"])
    .default("SCHEDULED"),
  expectedArrival: time.optional(),
  sellingUntil: time.optional(),
});
export const ruleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opens: time,
    closes: time,
    intervalWeeks: z.union([z.literal(1), z.literal(2)]).default(1),
    anchorDate: date.default("2026-01-05"),
  })
  .refine(
    (r) => new Date(r.anchorDate + "T00:00:00Z").getUTCDay() === 1,
    "วันอ้างอิงต้องเป็นวันจันทร์",
  )
  .refine((r) => r.opens !== r.closes, "เวลาเปิดและปิดต้องต่างกัน");
export const marketSchema = z.object({
  name: text,
  type: text.default("ตลาดนัด"),
  description: z.string().max(2000).default(""),
  address: z.string().max(500).default(""),
  entrance: z.string().max(500).default(""),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  timezone: z
    .string()
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "เขตเวลาไม่ถูกต้อง")
    .default("Asia/Bangkok"),
  active: z.boolean().default(true),
  layoutImage: image.nullish(),
});
export const stallSchema = z.object({
  zoneId: id,
  code: z.string().trim().min(1).max(20),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  active: z.boolean().default(true),
  directions: z.string().max(1000).default(""),
});
export const exceptionSchema = z
  .object({
    date,
    cancelled: z.boolean().default(false),
    opens: time.nullish(),
    closes: time.nullish(),
    reason: z.string().max(500).default(""),
  })
  .refine(
    (x) => x.cancelled || (!!x.opens && !!x.closes),
    "ระบุเวลาเปิดและปิด",
  );
export const reservationSchema = z.object({
  productId: id,
  quantity: z.number().int().min(1).max(100),
});
export const profileSchema = z.object({ name: text });
