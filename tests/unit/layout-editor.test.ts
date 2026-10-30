import { describe, expect, it } from "vitest";
import { canvasPoint, movePoint, numberedStalls } from "@/lib/layout-editor";

describe("market editor coordinate contract", () => {
  it("uses the displayed zoomed canvas rectangle, not its unzoomed parent", () => {
    expect(
      canvasPoint(450, 350, { left: 50, top: 50, width: 800, height: 600 }),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      canvasPoint(-50, 1000, { left: 50, top: 50, width: 800, height: 600 }),
    ).toEqual({ x: 0.02, y: 0.98 });
  });
  it("supports bounded keyboard movement without changing the other axis", () => {
    expect(movePoint({ x: 0.5, y: 0.5 }, "ArrowLeft", false)).toEqual({
      x: 0.49,
      y: 0.5,
    });
    expect(movePoint({ x: 0.97, y: 0.5 }, "ArrowRight", true)).toEqual({
      x: 0.98,
      y: 0.5,
    });
  });
  it("numbers a bounded grid and refuses invalid or off-canvas batches", () => {
    expect(
      numberedStalls({
        prefix: "A",
        start: 8,
        count: 3,
        columns: 2,
        x: 0.1,
        y: 0.2,
      }),
    ).toEqual([
      { code: "A08", x: 0.1, y: 0.2 },
      { code: "A09", x: 0.19, y: 0.2 },
      { code: "A10", x: 0.1, y: 0.29 },
    ]);
    expect(() =>
      numberedStalls({
        prefix: "A",
        start: 1,
        count: 51,
        columns: 5,
        x: 0.1,
        y: 0.2,
      }),
    ).toThrow();
    expect(() =>
      numberedStalls({
        prefix: "A",
        start: 1,
        count: 3,
        columns: 3,
        x: 0.9,
        y: 0.2,
      }),
    ).toThrow();
  });
});
