import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StallMap } from "@/components/stall-map";
import { market } from "../fixtures/market-view";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync("src/app/globals.css", "utf8");
describe("purposeful motion contract", () => {
  it("centralizes bounded duration and easing tokens", () => {
    for (const token of [
      "--motion-press: 110ms",
      "--motion-hover: 140ms",
      "--motion-control: 180ms",
      "--motion-feedback: 200ms",
      "--motion-enter: 240ms",
    ])
      expect(css).toContain(token);
    expect(css).toContain("cubic-bezier(0.215, 0.61, 0.355, 1)");
    expect(css).toContain("cubic-bezier(0.645, 0.045, 0.355, 1)");
    expect(css).not.toContain("will-change:");
  });
  it("gates hover and automatic motion by actual device/preferences", () => {
    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*transform: none/);
    expect(css).toContain(':not(:disabled):not([aria-disabled="true"]):active');
    expect(readFileSync("src/components/ui/button.tsx", "utf8")).not.toContain(
      "transition-all",
    );
  });
  it("keeps route data on the server and scopes map state to the displayed session", () => {
    expect(readFileSync("src/app/markets/page.tsx", "utf8")).not.toContain(
      '"use client"',
    );
    expect(readFileSync("src/components/marketplace.tsx", "utf8")).toContain(
      'from "next/form"',
    );
    const map = readFileSync("src/components/stall-map.tsx", "utf8");
    expect(map).toContain("sessionKey");
    const html = renderToStaticMarkup(createElement(StallMap, { market, selected: "A01" }));
    expect(html).toMatch(/class="stall-details [^"]+"/);
    expect(html).toContain("ข้าวอร่อย");
    expect(map).toContain("aria-controls={panelId}");
    expect(map).not.toContain("window.scrollTo");
    expect(map).not.toContain("scrollIntoView");
    expect(map).toContain("observer.disconnect()");
    expect(map).toContain("cancelAnimationFrame(frame)");
    expect(css).toContain("--map-aspect: 1.8");
    expect(css).toContain("--map-aspect: 1.1");
    expect(css.match(/aspect-ratio: var\(--map-aspect\)/g)).toHaveLength(2);
  });
  it("holds save requests while uploading and exposes real upload phases", () => {
    const forms = readFileSync("src/components/forms.tsx", "utf8");
    expect(forms).toContain("onBusyChange");
    expect(forms).toContain('setUploadState("verifying")');
    expect(forms).toContain(
      "disabled={!hydrated || isSubmitting || refreshing || uploading}",
    );
    expect(forms).toContain("aria-busy={busy || refreshing}");
    expect(forms).not.toContain("location.reload");
  });
});
