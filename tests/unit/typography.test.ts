import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
describe("centralized Thai typography", () => {
  it("loads the requested font pairing through next/font/google", () => {
    expect(layout).toContain(
      'import { Mali, Kodchasan } from "next/font/google"',
    );
    expect(layout).toContain('variable: "--font-mali"');
    expect(layout).toContain('variable: "--font-kodchasan"');
    expect(layout).not.toContain("next/font/local");
    expect(layout.match(/subsets: \["thai", "latin"\]/g)).toHaveLength(2);
    expect(layout.match(/display: "swap"/g)).toHaveLength(2);
    expect(layout).toContain('weight: ["500", "600", "700"]');
    expect(layout).toContain('weight: ["400", "500", "600", "700"]');
  });
  it("provides semantic display/body tokens without unsupported static weights", () => {
    expect(css).toContain("--font-sans: var(--font-kodchasan)");
    expect(css).toContain("--font-display: var(--font-mali)");
    expect(
      css
        .match(/font-weight:\s*(\d+)/g)
        ?.every((v) => /\b(400|500|600|700)\b/.test(v)),
    ).toBe(true);
    expect(css).not.toContain("--font-thai");
  });
});
