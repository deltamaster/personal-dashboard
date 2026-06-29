import type { Holding } from "@/lib/types/portfolio";

/** Rough FX to CNY for sort order — not for trading. */
export const FX_TO_CNY: Record<string, number> = {
  CNY: 1,
  USD: 7.2,
  HKD: 0.92,
};

export function toCnyEquivalent(value: number, currency?: string): number {
  const code = (currency ?? "CNY").toUpperCase();
  const rate = FX_TO_CNY[code] ?? 1;
  return value * rate;
}

export function holdingValueInCny(holding: Holding): number {
  return toCnyEquivalent(holding.current_value ?? 0, holding.currency);
}

function currencyPrefix(currency?: string): string {
  const code = (currency ?? "CNY").toUpperCase();
  if (code === "CNY") return "¥";
  if (code === "USD") return "$";
  if (code === "HKD") return "HK$";
  return `${code} `;
}

/** Format with thousands separators; keep original currency symbol. */
export function formatMoney(value: number, currency = "CNY"): string {
  const prefix = currencyPrefix(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

export function sortHoldingsByCnyValue(holdings: Holding[]): Holding[] {
  return [...holdings].sort(
    (a, b) => holdingValueInCny(b) - holdingValueInCny(a)
  );
}
