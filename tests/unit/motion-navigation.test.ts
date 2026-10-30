import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    "aria-current"?: string;
  }) =>
    createElement(
      "a",
      { href, "aria-current": props["aria-current"] },
      children,
    ),
  useLinkStatus: () => ({ pending: state.pending }),
}));
vi.mock("react-dom", () => ({
  useFormStatus: () => ({ pending: state.pending }),
}));
import { MarketSwitcher } from "../../src/components/market-switcher";
import { FormSubmit } from "../../src/components/pending-controls";

it("selects only the committed market and preserves the calendar week", () => {
  const html = renderToStaticMarkup(
    createElement(MarketSwitcher, {
      types: ["SMALL", "LARGE"],
      active: "LARGE",
      week: 2,
    }),
  );
  expect(html).toContain(
    'href="/markets?week=2&amp;type=LARGE" aria-current="page"',
  );
  expect(html).toContain("ตลาดเล็ก");
  expect(html).toContain("ตลาดใหญ่");
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toContain("--market-index:2");
});
it("disables the search submit only while its actual form is pending", () => {
  state.pending = true;
  const pending = renderToStaticMarkup(createElement(FormSubmit));
  expect(pending).toContain("disabled");
  expect(pending).toContain('aria-busy="true"');
  expect(pending).toContain("กำลังค้นหา");
  expect(pending).toContain("form-submit-spinner");
  expect(pending).toContain('aria-hidden="true" class="opacity-0">ค้นหา');
  state.pending = false;
  const ready = renderToStaticMarkup(createElement(FormSubmit));
  expect(ready).not.toContain('disabled=""');
  expect(ready).toContain("ค้นหา");
});
