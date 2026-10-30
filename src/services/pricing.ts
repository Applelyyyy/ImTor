import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { PriceView } from "@/lib/contracts";

export type DiscountInput = {
  id?: string;
  kind: string;
  value: number;
  startsAt: Date | string;
  endsAt: Date | string;
  priority?: number;
  repeatStart?: string | null;
  repeatEnd?: string | null;
  timezone?: string;
};
type Rule = DiscountInput & {
  start: number;
  end: number;
  price: number;
  index: number;
};
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = 86_400_000;
function dateShift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
function inWindow(rule: Rule, time: number): boolean {
  if (time < rule.start || time >= rule.end) return false;
  if (!rule.repeatStart) return true;
  const clock = formatInTimeZone(
    new Date(time),
    rule.timezone ?? "Asia/Bangkok",
    "HH:mm",
  );
  return rule.repeatStart < rule.repeatEnd!
    ? clock >= rule.repeatStart && clock < rule.repeatEnd!
    : clock >= rule.repeatStart || clock < rule.repeatEnd!;
}
function select(price: number, rules: Rule[], time: number): number {
  const active = rules
    .filter((rule) => inWindow(rule, time))
    .sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        a.price - b.price ||
        (a.id ?? "").localeCompare(b.id ?? "") ||
        a.index - b.index,
    );
  return active[0]?.price ?? price;
}
export class PricingService {
  static calculate(
    price: number,
    rules: DiscountInput[],
    now = new Date(),
  ): PriceView {
    if (
      !Number.isSafeInteger(price) ||
      price < 0 ||
      !Number.isFinite(now.getTime())
    )
      throw new Error(
        "Price must be nonnegative integer satang and clock valid",
      );
    const parsed: Rule[] = rules
      .map((rule, index) => {
        const start = new Date(rule.startsAt).getTime(),
          end = new Date(rule.endsAt).getTime();
        if (
          !["FIXED", "PERCENT_OFF", "FINAL_PERCENT"].includes(rule.kind) ||
          !Number.isSafeInteger(rule.value) ||
          rule.value < 0 ||
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end <= start ||
          !Number.isSafeInteger(rule.priority ?? 0)
        )
          throw new Error("Invalid discount rule");
        if (rule.kind !== "FIXED" && rule.value > 100)
          throw new Error("Percentage must be between 0 and 100");
        if (
          Boolean(rule.repeatStart) !== Boolean(rule.repeatEnd) ||
          (rule.repeatStart &&
            (!CLOCK.test(rule.repeatStart) ||
              !CLOCK.test(rule.repeatEnd!) ||
              rule.repeatStart === rule.repeatEnd))
        )
          throw new Error("Invalid repeating discount window");
        // Validate zone even when the rule is not active yet.
        formatInTimeZone(now, rule.timezone ?? "Asia/Bangkok", "yyyy-MM-dd");
        const factor =
          rule.kind === "PERCENT_OFF" ? 100 - rule.value : rule.value;
        const current =
          rule.kind === "FIXED"
            ? rule.value
            : Number((BigInt(price) * BigInt(factor) + 50n) / 100n);
        return { ...rule, start, end, price: current, index };
      })
      .filter((rule) => rule.price <= price);
    const time = now.getTime(),
      current = select(price, parsed, time);
    const candidates = new Set<number>();
    for (const rule of parsed) {
      if (rule.end <= time) continue;
      candidates.add(rule.start);
      candidates.add(rule.end);
      if (rule.repeatStart) {
        // At most tomorrow is needed for a daily window; start may be months away.
        const reference = new Date(Math.max(time, rule.start));
        const date = formatInTimeZone(
          reference,
          rule.timezone ?? "Asia/Bangkok",
          "yyyy-MM-dd",
        );
        for (let day = -1; day <= 2; day++)
          for (const clock of [rule.repeatStart, rule.repeatEnd!]) {
            const local = dateShift(date, day),
              instant = fromZonedTime(
                `${local}T${clock}:00`,
                rule.timezone ?? "Asia/Bangkok",
              );
            if (
              Number.isFinite(instant.getTime()) &&
              formatInTimeZone(
                instant,
                rule.timezone ?? "Asia/Bangkok",
                "yyyy-MM-dd HH:mm",
              ) === `${local} ${clock}`
            )
              candidates.add(instant.getTime());
          }
      }
    }
    let upcoming: PriceView["upcoming"] = null;
    for (const at of [...candidates]
      .filter((value) => value > time)
      .sort((a, b) => a - b)) {
      const future = select(price, parsed, at);
      if (future < current) {
        upcoming = { at: new Date(at).toISOString(), price: future };
        break;
      }
    }
    return {
      current,
      original: price,
      discountPercent:
        price === 0
          ? 0
          : Number(
              (BigInt(price - current) * 100n + BigInt(Math.floor(price / 2))) /
                BigInt(price),
            ),
      active: current < price,
      upcoming,
    };
  }
}
