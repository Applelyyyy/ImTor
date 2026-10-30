import { describe, expect, it } from "vitest";
import { groupByPoint } from "@/lib/market-map";

describe("coincident market stall groups", () => {
  it("groups normalized thousandth-coordinate buckets without altering source positions", () => {
    const input = [
      { id: "a", x: .25001, y: .40001 },
      { id: "b", x: .25002, y: .40002 },
      { id: "c", x: .251, y: .4 },
    ];
    const original = structuredClone(input);
    const groups = groupByPoint(input);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ key: "250:400", point: { x: .25001, y: .40001 }, stalls: [input[0], input[1]] });
    expect(groups[1].stalls).toEqual([input[2]]);
    expect(input).toEqual(original);
  });
  it("normalizes invalid/outside coordinates consistently and supports an empty map", () => {
    expect(groupByPoint([])).toEqual([]);
    const groups = groupByPoint([{ x: -1, y: 2 }, { x: 0, y: 1 }, { x: NaN, y: Infinity }]);
    expect(groups.map((group) => [group.key, group.stalls.length])).toEqual([["0:1000", 2], ["500:500", 1]]);
  });
  it("handles a large array with stable insertion order and no pairwise scanning", () => {
    const input = Array.from({ length: 100_000 }, (_, id) => ({ id, x: (id % 1000) / 1000, y: .5 }));
    const groups = groupByPoint(input);
    expect(groups).toHaveLength(1000);
    expect(groups[0].stalls).toHaveLength(100);
    expect(groups[999].stalls.at(-1)?.id).toBe(99_999);
    expect(groups.flatMap((group) => group.stalls)).toHaveLength(input.length);
  });
});
