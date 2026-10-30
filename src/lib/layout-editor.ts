export type LayoutPoint = { x: number; y: number };
const clamp = (value: number) => Math.min(0.98, Math.max(0.02, value));
export function canvasPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): LayoutPoint {
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}
export function movePoint(
  point: LayoutPoint,
  key: string,
  fast: boolean,
): LayoutPoint {
  const step = fast ? 0.05 : 0.01;
  return {
    x: clamp(
      point.x + (key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0),
    ),
    y: clamp(
      point.y + (key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0),
    ),
  };
}
export type StallBatch = {
  prefix: string;
  start: number;
  count: number;
  columns: number;
  x: number;
  y: number;
};
export function numberedStalls(input: StallBatch) {
  if (
    !/^[\p{L}\p{N}_-]{1,10}$/u.test(input.prefix) ||
    !Number.isInteger(input.start) ||
    input.start < 1 ||
    input.start > 9999 ||
    !Number.isInteger(input.count) ||
    input.count < 1 ||
    input.count > 50 ||
    !Number.isInteger(input.columns) ||
    input.columns < 1 ||
    input.columns > 10 ||
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.y)
  )
    throw new Error("ข้อมูลชุดล็อกไม่ถูกต้อง (สูงสุด 50 ล็อก)");
  const rows = Array.from({ length: input.count }, (_, index) => ({
    code: `${input.prefix}${String(input.start + index).padStart(2, "0")}`,
    x: Math.round((input.x + (index % input.columns) * 0.09) * 10000) / 10000,
    y:
      Math.round((input.y + Math.floor(index / input.columns) * 0.09) * 10000) /
      10000,
  }));
  if (
    rows.some(
      (row) => row.x < 0.02 || row.y < 0.02 || row.x > 0.98 || row.y > 0.98,
    )
  )
    throw new Error("ชุดล็อกเกินขอบผัง เลือกตำแหน่งใหม่หรือลดจำนวน");
  return rows;
}
