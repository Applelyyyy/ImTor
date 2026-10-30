import type { CSSProperties } from "react";
import { NavigationLink } from "@/components/pending-controls";

export function MarketSwitcher({
  types,
  active = "",
  week = 0,
}: {
  types: string[];
  active?: string;
  week?: number;
}) {
  const choices = ["", ...types];
  const index = Math.max(0, choices.indexOf(active));
  const labels: Record<string, string> = {
    "": "ทุกตลาด",
    SMALL: "ตลาดเล็ก",
    LARGE: "ตลาดใหญ่",
  };
  return (
    <nav
      className="market-switcher"
      aria-label="ประเภทตลาด"
      style={
        {
          "--market-count": choices.length,
          "--market-index": index,
        } as CSSProperties
      }
    >
      <span className="market-switcher-indicator" aria-hidden="true" />
      {choices.map((type) => (
        <NavigationLink
          key={type}
          href={
            "/markets?" +
            new URLSearchParams({ week: String(week), ...(type && { type }) })
          }
          aria-current={choices[index] === type ? "page" : undefined}
          scroll={false}
        >
          {labels[type] || type}
        </NavigationLink>
      ))}
    </nav>
  );
}
