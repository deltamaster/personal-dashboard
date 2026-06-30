import type { Holding } from "@/lib/types/portfolio";

const IMMEDIATE_ASSET_TYPES = new Set(["stock", "etf"]);

/** Patch applied when a holding is fully redeemed (zeroed, hidden from active list). */
export function redemptionZeroPatch(): Pick<
  Holding,
  "current_value" | "quantity" | "current_nav" | "scheduled_redeem_at"
> {
  return {
    current_value: 0,
    quantity: 0,
    current_nav: 0,
    scheduled_redeem_at: "",
  };
}

export function canRedeemImmediately(holding: Holding): boolean {
  const type = (holding.asset_type ?? "").toLowerCase();
  if (IMMEDIATE_ASSET_TYPES.has(type)) return true;
  if (type === "bond") {
    const name = `${holding.name} ${holding.name_en ?? ""}`.toLowerCase();
    if (/活期|现金|货币|money market|cash/.test(name)) return true;
  }
  return false;
}

function parseDateOnly(isoOrDate: string): Date {
  const d = isoOrDate.slice(0, 10);
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addCalendarDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

/** Why the modal pre-fills a date (for UI hint). */
export function redeemDateDefaultHint(holding: Holding): string | null {
  const type = (holding.asset_type ?? "").toLowerCase();
  if (holding.maturity?.trim()) {
    return `Default from maturity (${holding.maturity.trim().slice(0, 10)})`;
  }
  if (type === "fund") return "Default: T+3 trading days (calendar +3)";
  if (!canRedeemImmediately(holding)) return "Default: T+1 (calendar +1)";
  return null;
}

/** Default expected redemption date when immediate redeem is not available. */
export function suggestRedeemDate(holding: Holding, from = new Date()): string {
  const type = (holding.asset_type ?? "").toLowerCase();
  const today = formatDateOnly(from);

  if (holding.maturity?.trim()) {
    const maturity = holding.maturity.trim().slice(0, 10);
    return maturity >= today ? maturity : today;
  }
  if (type === "fund") {
    return addCalendarDays(from, 3);
  }
  return addCalendarDays(from, 1);
}

export function isScheduledRedemptionPending(holding: Holding): boolean {
  const at = holding.scheduled_redeem_at?.trim();
  if (!at || (holding.current_value ?? 0) <= 0) return false;
  return at.slice(0, 10) > formatDateOnly(new Date());
}

export function isScheduledRedemptionDue(holding: Holding, now = new Date()): boolean {
  const at = holding.scheduled_redeem_at?.trim();
  if (!at || (holding.current_value ?? 0) <= 0) return false;
  return at.slice(0, 10) <= formatDateOnly(now);
}

export function formatRedeemDateLabel(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function validateScheduleRedeemDate(redeemAt: string): string | null {
  const d = redeemAt.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Invalid date (use YYYY-MM-DD)";
  const parsed = parseDateOnly(d);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  const today = formatDateOnly(new Date());
  if (d < today) return "Redemption date cannot be in the past";
  return null;
}
