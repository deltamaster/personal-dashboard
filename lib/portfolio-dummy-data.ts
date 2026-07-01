import { computePortfolioStats } from "@/lib/ots/portfolio";
import { filterActiveHoldings, sortHoldingsByCnyValue } from "@/lib/portfolio-format";
import {
  isScheduledRedemptionDue,
  redemptionZeroPatch,
} from "@/lib/portfolio-redeem";
import type { Holding, Snapshot } from "@/lib/types/portfolio";

const CREATED = "2024-06-01T00:00:00Z";
const RECENT = "2026-06-16T00:00:00Z";
const STALE_R4 = "2026-01-15T00:00:00Z";
const STALE_R3 = "2026-02-01T00:00:00Z";
const STALE_R5 = "2026-03-10T00:00:00Z";

/** Dev-only sample data — opt in with PORTFOLIO_DUMMY_DATA=1 (dev only). */
export function shouldUsePortfolioDummyData(): boolean {
  if (process.env.QA_DUMMY_DATA === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.PORTFOLIO_DUMMY_DATA === "1";
}

function mkHolding(
  holdingId: string,
  fields: Omit<Holding, "holding_id" | "created_at" | "updated_at" | "unrealized_pnl" | "unrealized_pct" | "total_return" | "total_return_pct"> & {
    updated_at?: string;
  }
): Holding {
  const purchaseAmount = fields.purchase_amount ?? 0;
  const currentValue = fields.current_value ?? 0;
  const cashDividend = fields.cash_dividend ?? 0;
  const unrealizedPnl = currentValue - purchaseAmount;
  const unrealizedPct =
    purchaseAmount > 0 ? (unrealizedPnl / purchaseAmount) * 100 : 0;
  const totalReturn = unrealizedPnl + cashDividend;
  const totalReturnPct =
    purchaseAmount > 0 ? (totalReturn / purchaseAmount) * 100 : 0;

  return {
    ...fields,
    holding_id: holdingId,
    cash_dividend: cashDividend,
    unrealized_pnl: unrealizedPnl,
    unrealized_pct: unrealizedPct,
    total_return: totalReturn,
    total_return_pct: totalReturnPct,
    created_at: CREATED,
    updated_at: fields.updated_at ?? RECENT,
  };
}

const dummyHoldings: Holding[] = [
  mkHolding("dummy-holding-us-growth", {
    name: "美国成长精选基金",
    name_en: "US Growth Select",
    ticker: "USGRW",
    bank: "招商银行",
    asset_type: "fund",
    risk_level: 4,
    currency: "USD",
    quantity: 1,
    purchase_amount: 44000,
    current_value: 42900,
    updated_at: STALE_R4,
  }),
  mkHolding("dummy-holding-us-tech", {
    name: "纳斯达克科技ETF",
    name_en: "Nasdaq Tech ETF",
    ticker: "QQQ",
    bank: "花旗银行",
    asset_type: "etf",
    risk_level: 5,
    currency: "USD",
    quantity: 50,
    purchase_nav: 520,
    current_nav: 520,
    purchase_amount: 9000,
    current_value: 26000,
    updated_at: STALE_R5,
  }),
  mkHolding("dummy-holding-cny-bond", {
    name: "国债逆回购",
    bank: "工商银行",
    asset_type: "bond",
    risk_level: 1,
    currency: "CNY",
    purchase_amount: 20000,
    current_value: 20100,
  }),
  mkHolding("dummy-holding-us-bond", {
    name: "美国国债基金",
    name_en: "US Treasury Fund",
    bank: "汇丰银行",
    asset_type: "fund",
    risk_level: 2,
    currency: "USD",
    purchase_amount: 20100,
    current_value: 20000,
  }),
  mkHolding("dummy-holding-structured", {
    name: "结构性存款",
    bank: "浦发银行",
    asset_type: "structured_deposit",
    risk_level: 3,
    currency: "CNY",
    purchase_amount: 12000,
    current_value: 12000,
    coupon_rate: 3.2,
    maturity: "2026-12-31",
    updated_at: STALE_R3,
  }),
  mkHolding("dummy-holding-cny-money", {
    name: "货币基金",
    bank: "招商银行",
    asset_type: "fund",
    risk_level: 1,
    currency: "CNY",
    purchase_amount: 10000,
    current_value: 10000,
    cash_dividend: 320,
  }),
  mkHolding("dummy-holding-hk-etf", {
    name: "恒生科技ETF",
    ticker: "3033.HK",
    bank: "中信证券",
    asset_type: "etf",
    risk_level: 4,
    currency: "HKD",
    purchase_amount: 42000,
    current_value: 45000,
  }),
  mkHolding("dummy-holding-a-stock", {
    name: "贵州茅台",
    ticker: "600519",
    bank: "华泰证券",
    asset_type: "stock",
    risk_level: 4,
    currency: "CNY",
    quantity: 40,
    purchase_nav: 1400,
    current_nav: 135.55,
    purchase_amount: 5800,
    current_value: 5422,
  }),
  mkHolding("dummy-holding-cny-fund", {
    name: "沪深300指数基金",
    bank: "招商银行",
    asset_type: "fund",
    risk_level: 3,
    currency: "CNY",
    purchase_amount: 18000,
    current_value: 19200,
  }),
  mkHolding("dummy-holding-cash", {
    name: "活期存款",
    bank: "工商银行",
    asset_type: "bond",
    risk_level: 1,
    currency: "CNY",
    purchase_amount: 2000,
    current_value: 2000,
  }),
  mkHolding("dummy-holding-us-stock", {
    name: "苹果公司",
    name_en: "Apple Inc.",
    ticker: "AAPL",
    bank: "花旗银行",
    asset_type: "stock",
    risk_level: 4,
    currency: "USD",
    quantity: 100,
    purchase_nav: 210,
    current_nav: 191.55,
    purchase_amount: 6575,
    current_value: 19155,
    cash_dividend: 85,
  }),
  mkHolding("dummy-holding-cny-growth", {
    name: "新能源主题基金",
    bank: "兴业银行",
    asset_type: "fund",
    risk_level: 5,
    currency: "CNY",
    purchase_amount: 8000,
    current_value: 6500,
  }),
];

const dummyPatches = new Map<string, Partial<Holding>>();

function getMergedDummyHoldings(): Holding[] {
  return dummyHoldings.map((holding) => {
    const patch = dummyPatches.get(holding.holding_id);
    if (!patch) return holding;
    const merged = { ...holding, ...patch };
    if (patch.scheduled_redeem_at === "") {
      delete merged.scheduled_redeem_at;
    }
    return merged;
  });
}

function applyDummyDueRedemptions(): void {
  for (const holding of getMergedDummyHoldings()) {
    if (isScheduledRedemptionDue(holding)) {
      dummyPatches.set(holding.holding_id, {
        ...redemptionZeroPatch(),
        updated_at: new Date().toISOString(),
      });
    }
  }
}

export function redeemDummyHolding(holdingId: string): Holding | null {
  if (!dummyHoldings.some((h) => h.holding_id === holdingId)) return null;
  dummyPatches.set(holdingId, {
    ...redemptionZeroPatch(),
    updated_at: new Date().toISOString(),
  });
  return getMergedDummyHoldings().find((h) => h.holding_id === holdingId) ?? null;
}

export function scheduleDummyRedemption(holdingId: string, redeemAt: string): Holding | null {
  if (!dummyHoldings.some((h) => h.holding_id === holdingId)) return null;
  const existing = dummyPatches.get(holdingId) ?? {};
  dummyPatches.set(holdingId, {
    ...existing,
    scheduled_redeem_at: redeemAt.slice(0, 10),
    updated_at: new Date().toISOString(),
  });
  return getMergedDummyHoldings().find((h) => h.holding_id === holdingId) ?? null;
}

const dummySnapshots: Snapshot[] = [
  { snapshot_date: "2026-04-18", total_value: 582000, total_pnl: 42000, total_dividend: 3200, total_return: 45200, created_at: CREATED },
  { snapshot_date: "2026-04-25", total_value: 588500, total_pnl: 44500, total_dividend: 3250, total_return: 47750, created_at: CREATED },
  { snapshot_date: "2026-05-02", total_value: 591200, total_pnl: 45800, total_dividend: 3280, total_return: 49080, created_at: CREATED },
  { snapshot_date: "2026-05-09", total_value: 596800, total_pnl: 47200, total_dividend: 3310, total_return: 50510, created_at: CREATED },
  { snapshot_date: "2026-05-16", total_value: 601400, total_pnl: 48600, total_dividend: 3340, total_return: 51940, created_at: CREATED },
  { snapshot_date: "2026-05-23", total_value: 605900, total_pnl: 49800, total_dividend: 3380, total_return: 53180, created_at: CREATED },
  { snapshot_date: "2026-05-30", total_value: 609200, total_pnl: 50800, total_dividend: 3410, total_return: 54210, created_at: CREATED },
  { snapshot_date: "2026-06-06", total_value: 612800, total_pnl: 51800, total_dividend: 3440, total_return: 55240, created_at: CREATED },
  { snapshot_date: "2026-06-13", total_value: 616500, total_pnl: 52800, total_dividend: 3470, total_return: 56270, created_at: CREATED },
  { snapshot_date: "2026-06-23", total_value: 621300, total_pnl: 53800, total_dividend: 3500, total_return: 57300, created_at: CREATED },
];

export function getDummyPortfolioHoldingsData() {
  applyDummyDueRedemptions();
  const holdings = sortHoldingsByCnyValue(filterActiveHoldings(getMergedDummyHoldings()));
  const stats = computePortfolioStats(holdings);
  return { holdings, stats };
}

export function getDummyPortfolioSnapshotsData() {
  return { snapshots: dummySnapshots };
}
