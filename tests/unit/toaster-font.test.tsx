import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("sonner", () => ({ Toaster: ({ style }: { style?: React.CSSProperties }) => <div style={style} /> }));
import { Toaster } from "@/components/ui/sonner";
it("keeps Thai notifications in the application operational font", () => {
  expect(renderToStaticMarkup(<Toaster />)).toContain("font-family:var(--font-kodchasan), sans-serif");
});
