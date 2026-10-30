export type MerchantProductDraft = {
  name: string; imageUrl: string; price: string; description: string; categoryId: string;
  mode: string; reservable: boolean; tracking: boolean; quantity: string; pickupStart: string; pickupEnd: string;
  allergens: string; storage: string;
};
/** Content edits omit stock; target edits carry the observed balance and a retry identity. */
export function merchantProductInput(
  draft: MerchantProductDraft,
  previous?: { stock?: number | null; reservable: boolean; pickupStart?: string | null; pickupEnd?: string | null },
  stockAdjustmentKey?: string,
) {
  if (!draft.name.trim() || !draft.imageUrl || !draft.categoryId) throw new Error("กรุณาเพิ่มภาพ ชื่อ และหมวดหมู่สินค้า");
  if (!/^\d+(\.\d{1,2})?$/.test(draft.price) || !Number.isFinite(Number(draft.price))) throw new Error("กรุณาระบุราคาเป็นบาท ไม่เกินสองตำแหน่งทศนิยม");
  const price = Math.round(Number(draft.price) * 100);
  if (price > 100_000_000) throw new Error("ราคาสูงเกินกำหนด");
  const instant = (value: string) => {
    if (!value) return null;
    const date = new Date(`${value}+07:00`);
    if (!Number.isFinite(date.getTime())) throw new Error("กรุณาระบุวันและเวลารับสินค้าให้ถูกต้อง");
    return date.toISOString();
  };
  const pickupStart = instant(draft.pickupStart);
  const pickupEnd = instant(draft.pickupEnd);
  if (draft.reservable && (!pickupStart || !pickupEnd || pickupEnd <= pickupStart)) throw new Error("ระบุเวลาเริ่มและสิ้นสุดรับสินค้าให้ถูกต้อง");
  if (draft.reservable && !draft.tracking) throw new Error("การจองต้องติดตามจำนวนสินค้า");
  if (draft.tracking && (!/^\d+$/.test(draft.quantity) || Number(draft.quantity) > 1_000_000)) throw new Error("กรุณาระบุจำนวนสินค้า 0–1,000,000 ชิ้น");
  const stock = draft.tracking ? Number(draft.quantity) : null;
  const stockChanged = previous?.stock !== undefined && stock !== previous.stock;
  if (stockChanged && (!stockAdjustmentKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(stockAdjustmentKey))) throw new Error("กรุณาเริ่มคำขอปรับจำนวนใหม่");
  const local = (value: string | null | undefined) => value ? new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "";
  const window = {
    ...(!previous || !("pickupStart" in previous) || draft.pickupStart !== local(previous.pickupStart) ? { pickupStart } : {}),
    ...(!previous || !("pickupEnd" in previous) || draft.pickupEnd !== local(previous.pickupEnd) ? { pickupEnd } : {}),
  };
  return {
    name: draft.name.trim(), imageUrl: draft.imageUrl, price, categoryId: draft.categoryId,
    description: draft.description, mode: draft.mode, reservable: draft.reservable,
    ...(!previous ? { stock } : stockChanged ? { stock, expectedStock: previous.stock!, stockAdjustmentKey } : {}),
    ...window, allergens: draft.allergens || null, storage: draft.storage || null,
  };
}
