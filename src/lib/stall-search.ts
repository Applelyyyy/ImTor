import type { StallView } from "@/lib/contracts";

/** Search only the already-authorized, selected-session public projection. */
export function searchStalls(stalls: StallView[], query: string): StallView[] {
  const needle = query.trim().toLocaleLowerCase("th");
  return stalls.filter((stall) => stall.active &&
    [stall.code, stall.zone, stall.vendor?.name ?? "", ...(stall.vendor?.productNames ?? stall.vendor?.products.map((product) => product.name) ?? [])]
      .some((value) => value.toLocaleLowerCase("th").includes(needle)));
}
