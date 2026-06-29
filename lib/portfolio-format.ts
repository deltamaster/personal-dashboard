import type { Holding, Snapshot } from "@/lib/types/portfolio";

/** Rough FX to CNY for sort order — not for trading. */
export const FX_TO_CNY: Record<string, number> = {
  CNY: 1,
  USD: 7.2,
  HKD: 0.92,
};

export interface NavHistoryPoint {
  date: string;
  value: number;
}

export function toCnyEquivalent(value: number, currency?: string): number {
  const code = (currency ?? "CNY").toUpperCase();
  const rate = FX_TO_CNY[code] ?? 1;
  return value * rate;
}

export function holdingValueInCny(holding: Holding): number {
  return toCnyEquivalent(holding.current_value ?? 0, holding.currency);
}

/** Holdings with zero current value are treated as redeemed — hide from UI and stats. */
export function isActiveHolding(holding: Holding): boolean {
  return (holding.current_value ?? 0) > 0;
}

export function filterActiveHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter(isActiveHolding);
}

export function currencyPrefix(currency?: string): string {
  const code = (currency ?? "CNY").toUpperCase();
  if (code === "CNY") return "¥";
  if (code === "USD") return "$";
  if (code === "HKD") return "HK$";
  return `${code} `;
}

/** Format with thousands separators; keep original currency symbol. */
export function formatMoney(value: number, currency = "CNY"): string {
  const { sign, prefix, integer, decimal } = formatMoneyParts(value, currency);
  return `${sign}${prefix}${integer}.${decimal}`;
}

export function formatMoneyParts(
  value: number,
  currency = "CNY"
): { sign: string; prefix: string; integer: string; decimal: string } {
  const prefix = currencyPrefix(currency);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const fixed = abs.toFixed(2);
  const dot = fixed.indexOf(".");
  const intRaw = fixed.slice(0, dot);
  const decimal = fixed.slice(dot + 1);
  const integer = Number(intRaw).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  return { sign, prefix, integer, decimal };
}

/** Short axis labels for charts — e.g. ¥4.31M, ¥57.14K. */
export function formatMoneyCompact(value: number, currency = "CNY"): string {
  const prefix = currencyPrefix(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(2)}K`;
  }
  return formatMoney(value, currency);
}

export function maskMoneyParts(currency = "CNY"): {
  sign: string;
  prefix: string;
  integer: string;
  decimal: string;
} {
  return {
    sign: "",
    prefix: currencyPrefix(currency),
    integer: "****",
    decimal: "**",
  };
}

export function maskMoney(currency = "CNY"): string {
  const { prefix, integer, decimal } = maskMoneyParts(currency);
  return `${prefix}${integer}.${decimal}`;
}

export function maskMoneyCompact(currency = "CNY"): string {
  return `${currencyPrefix(currency)}****`;
}

export function maskPercent(): string {
  return "**.**%";
}

export function maskInteger(): string {
  return "**";
}

export function sortHoldingsByCnyValue(holdings: Holding[]): Holding[] {
  return [...holdings].sort(
    (a, b) => holdingValueInCny(b) - holdingValueInCny(a)
  );
}

export function sumHoldingsNavCny(holdings: Holding[]): number {
  return holdings.reduce((sum, holding) => sum + holdingValueInCny(holding), 0);
}

function inferWanScale(snapshotValues: number[], currentNavCny: number): number {
  const positive = snapshotValues.filter((value) => value > 0);
  if (positive.length === 0 || currentNavCny <= 0) return 1;

  const max = Math.max(...positive);
  if (max >= currentNavCny * 0.5) return 1;

  const asWan = max * 10000;
  if (asWan >= currentNavCny * 0.5 && asWan <= currentNavCny * 2) {
    return 10000;
  }

  return 1;
}

/** Align snapshot history with live holdings NAV (CNY) for chart display. */
export function buildNavHistoryPoints(
  snapshots: Snapshot[],
  currentNavCny: number
): NavHistoryPoint[] {
  const sorted = [...snapshots]
    .filter((snapshot) => snapshot.snapshot_date && snapshot.total_value != null)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .slice(-24);

  if (sorted.length === 0) {
    if (currentNavCny <= 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return [{ date: today, value: currentNavCny }];
  }

  const rawValues = sorted.map((snapshot) => snapshot.total_value ?? 0);
  const unitScale = inferWanScale(rawValues, currentNavCny);
  let points: NavHistoryPoint[] = sorted.map((snapshot) => ({
    date: snapshot.snapshot_date,
    value: (snapshot.total_value ?? 0) * unitScale,
  }));

  const lastPoint = points[points.length - 1];
  if (lastPoint && currentNavCny > 0 && lastPoint.value > 0) {
    const ratio = currentNavCny / lastPoint.value;
    if (ratio > 1.5 || ratio < 0.67) {
      points = points.map((point) => ({ ...point, value: point.value * ratio }));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const last = points[points.length - 1];
  if (!last || last.date < today) {
    points.push({ date: today, value: currentNavCny });
  } else {
    last.value = currentNavCny;
  }

  return points;
}
