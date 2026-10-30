/** All market views and the admin editor use the same database-normalized canvas. */
export type MapPoint = { x: number; y: number };
export const SCHEMATIC_ASPECT_RATIO = 4 / 3;
export function imageAspectRatio(width: number, height: number): number {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? width / height : SCHEMATIC_ASPECT_RATIO;
}
export function normalizedPoint(point: MapPoint): MapPoint {
  const coordinate = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .5;
  return { x: coordinate(point.x), y: coordinate(point.y) };
}
export function zoneLabels(stalls: readonly (MapPoint & { zone: string })[]) {
  const groups = new Map<string, MapPoint[]>();
  for (const stall of stalls) {
    if (!stall.zone) continue;
    const points = groups.get(stall.zone) ?? [];
    points.push(normalizedPoint(stall));
    groups.set(stall.zone, points);
  }
  return Array.from(groups, ([name, points]) => ({
    name,
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: Math.max(.03, Math.min(...points.map((point) => point.y)) - .065),
  }));
}

/** Co-located records remain at their persisted position; the UI offers a chooser.
 * Integer buckets avoid floating-point string differences without an O(n²) scan. */
export function groupByPoint<T extends MapPoint>(stalls: readonly T[]) {
  const groups = new Map<string, { key: string; point: MapPoint; stalls: T[] }>();
  for (const stall of stalls) {
    const point = normalizedPoint(stall);
    const key = `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;
    const group = groups.get(key);
    if (group) group.stalls.push(stall);
    else groups.set(key, { key, point, stalls: [stall] });
  }
  return Array.from(groups.values());
}
