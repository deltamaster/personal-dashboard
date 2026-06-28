export type AssetType =
  | "fund"
  | "stock"
  | "structured_deposit"
  | "bond"
  | "etf";

export interface Holding {
  holding_id: string;
  name: string;
  name_en?: string;
  ticker?: string;
  issuer?: string;
  bank?: string;
  asset_type?: AssetType | string;
  risk_level?: number;
  currency?: string;
  quantity?: number;
  purchase_nav?: number;
  current_nav?: number;
  purchase_amount?: number;
  current_value?: number;
  unrealized_pnl?: number;
  unrealized_pct?: number;
  cash_dividend?: number;
  total_return?: number;
  total_return_pct?: number;
  coupon_rate?: number;
  knockin_level?: number;
  autocall_level?: number;
  strike_level?: number;
  maturity?: string;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type HoldingInput = Partial<Omit<Holding, "created_at" | "updated_at">> & {
  name: string;
  created_at?: string;
  updated_at?: string;
};

export interface Snapshot {
  snapshot_date: string;
  total_value?: number;
  total_pnl?: number;
  total_dividend?: number;
  total_return?: number;
  created_at: string;
}

export type SnapshotInput = Omit<Snapshot, "created_at"> & {
  created_at?: string;
};

export interface RiskLevelStat {
  level: number;
  value: number;
  count: number;
}

export interface BreakdownStat {
  label: string;
  value: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalPnl: number;
  totalDividend: number;
  totalReturn: number;
  holdingCount: number;
  defensiveRatio: number;
  byRiskLevel: RiskLevelStat[];
  byBank: BreakdownStat[];
  byAssetType: BreakdownStat[];
  staleHoldingIds: string[];
}
