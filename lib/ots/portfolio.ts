import { randomUUID } from "node:crypto";
import { sortHoldingsByCnyValue } from "@/lib/portfolio-format";
import {
  coerceOtsNumber,
  getOtsClient,
  nextStartPrimaryKey,
  rowToObject,
  toAttributeColumns,
} from "@/lib/ots";
import { otsCall, TableStore } from "@/lib/ots-client";
import type {
  BreakdownStat,
  Holding,
  HoldingInput,
  PortfolioStats,
  RiskLevelStat,
  Snapshot,
  SnapshotInput,
} from "@/lib/types/portfolio";

const HOLDINGS_TABLE = "pd_holdings";
const SNAPSHOTS_TABLE = "pd_snapshots";

const VALUATION_FIELDS = new Set([
  "quantity",
  "current_nav",
  "purchase_amount",
  "cash_dividend",
]);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeHolding(raw: Record<string, unknown>): Holding {
  const numericFields = [
    "risk_level",
    "quantity",
    "purchase_nav",
    "current_nav",
    "purchase_amount",
    "current_value",
    "unrealized_pnl",
    "unrealized_pct",
    "cash_dividend",
    "total_return",
    "total_return_pct",
    "coupon_rate",
    "knockin_level",
    "autocall_level",
    "strike_level",
  ] as const;

  const holding = { ...(raw as unknown as Holding) };
  for (const field of numericFields) {
    const value = coerceOtsNumber(raw[field]);
    if (value != null) {
      (holding as Record<string, unknown>)[field] = value;
    }
  }
  if (holding.risk_level != null) {
    holding.risk_level = Math.min(5, Math.max(1, Math.round(holding.risk_level)));
  }
  return holding;
}

function normalizeSnapshot(raw: Record<string, unknown>): Snapshot {
  return {
    ...(raw as unknown as Snapshot),
    total_value: coerceOtsNumber(raw.total_value),
    total_pnl: coerceOtsNumber(raw.total_pnl),
    total_dividend: coerceOtsNumber(raw.total_dividend),
    total_return: coerceOtsNumber(raw.total_return),
  };
}

function applyComputedFields(holding: Holding): Holding {
  let currentValue = holding.current_value ?? 0;
  const quantity = holding.quantity;
  const currentNav = holding.current_nav;
  if (quantity != null && currentNav != null) {
    currentValue = quantity * currentNav;
  }

  const purchaseAmount = holding.purchase_amount ?? 0;
  const cashDividend = holding.cash_dividend ?? 0;
  const unrealizedPnl = currentValue - purchaseAmount;
  const unrealizedPct =
    purchaseAmount > 0 ? (unrealizedPnl / purchaseAmount) * 100 : 0;
  const totalReturn = currentValue - purchaseAmount + cashDividend;
  const totalReturnPct =
    purchaseAmount > 0 ? (totalReturn / purchaseAmount) * 100 : 0;

  return {
    ...holding,
    current_value: currentValue,
    unrealized_pnl: unrealizedPnl,
    unrealized_pct: unrealizedPct,
    total_return: totalReturn,
    total_return_pct: totalReturnPct,
  };
}

function holdingAttributes(holding: Holding): Record<string, string | number | undefined> {
  return {
    name: holding.name,
    name_en: holding.name_en,
    ticker: holding.ticker,
    issuer: holding.issuer,
    bank: holding.bank,
    asset_type: holding.asset_type,
    risk_level: holding.risk_level,
    currency: holding.currency,
    quantity: holding.quantity,
    purchase_nav: holding.purchase_nav,
    current_nav: holding.current_nav,
    purchase_amount: holding.purchase_amount,
    current_value: holding.current_value,
    unrealized_pnl: holding.unrealized_pnl,
    unrealized_pct: holding.unrealized_pct,
    cash_dividend: holding.cash_dividend,
    total_return: holding.total_return,
    total_return_pct: holding.total_return_pct,
    coupon_rate: holding.coupon_rate,
    knockin_level: holding.knockin_level,
    autocall_level: holding.autocall_level,
    strike_level: holding.strike_level,
    maturity: holding.maturity,
    purchase_date: holding.purchase_date,
    notes: holding.notes,
    created_at: holding.created_at,
    updated_at: holding.updated_at,
  };
}

async function scanTable<T>(
  tableName: string,
  pkName: string,
  normalize: (raw: Record<string, unknown>) => T
): Promise<T[]> {
  const client = getOtsClient();
  const rows: T[] = [];
  let startKey: Record<string, unknown>[] = [{ [pkName]: TableStore.INF_MIN }];
  let done = false;

  while (!done) {
    const result = await otsCall<{
      rows?: unknown[];
      nextStartPrimaryKey?: { name: string; value: unknown }[];
    }>(client.getRange.bind(client), {
      tableName,
      direction: TableStore.Direction.FORWARD,
      inclusiveStartPrimaryKey: startKey,
      exclusiveEndPrimaryKey: [{ [pkName]: TableStore.INF_MAX }],
      limit: 100,
    });

    for (const row of result.rows ?? []) {
      rows.push(normalize(rowToObject(row as Parameters<typeof rowToObject>[0])));
    }

    const next = result.nextStartPrimaryKey;
    if (next?.length) {
      startKey = nextStartPrimaryKey(next);
    } else {
      done = true;
    }
  }

  return rows;
}

export async function listHoldings(): Promise<Holding[]> {
  const holdings = await scanTable(HOLDINGS_TABLE, "holding_id", normalizeHolding);
  return sortHoldingsByCnyValue(holdings);
}

export async function getHolding(holdingId: string): Promise<Holding | null> {
  const client = getOtsClient();
  try {
    const result = await otsCall<{ row?: unknown }>(client.getRow.bind(client), {
      tableName: HOLDINGS_TABLE,
      primaryKey: [{ holding_id: holdingId }],
    });
    if (!result.row) return null;
    return normalizeHolding(
      rowToObject(result.row as Parameters<typeof rowToObject>[0])
    );
  } catch {
    return null;
  }
}

export async function createHolding(input: HoldingInput): Promise<Holding> {
  const client = getOtsClient();
  const ts = nowIso();
  const holdingId = input.holding_id?.trim() || randomUUID();
  let holding: Holding = {
    ...input,
    holding_id: holdingId,
    created_at: input.created_at ?? ts,
    updated_at: input.updated_at ?? ts,
  };
  holding = applyComputedFields(holding);

  await otsCall(client.putRow.bind(client), {
    tableName: HOLDINGS_TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ holding_id: holdingId }],
    attributeColumns: toAttributeColumns(holdingAttributes(holding)),
  });

  return holding;
}

export async function updateHolding(
  holdingId: string,
  patch: Partial<Omit<HoldingInput, "holding_id">>
): Promise<Holding | null> {
  const existing = await getHolding(holdingId);
  if (!existing) return null;

  const valuationChanged = Object.keys(patch).some((key) => VALUATION_FIELDS.has(key));
  const ts = nowIso();

  let updated: Holding = {
    ...existing,
    ...patch,
    holding_id: holdingId,
    updated_at: valuationChanged ? ts : existing.updated_at,
  };
  updated = applyComputedFields(updated);

  const client = getOtsClient();
  await otsCall(client.putRow.bind(client), {
    tableName: HOLDINGS_TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ holding_id: holdingId }],
    attributeColumns: toAttributeColumns(holdingAttributes(updated)),
  });

  return updated;
}

export async function deleteHolding(holdingId: string): Promise<boolean> {
  const existing = await getHolding(holdingId);
  if (!existing) return false;

  const client = getOtsClient() as unknown as {
    deleteRow: (
      params: Record<string, unknown>,
      callback: (err: Error | null, data?: unknown) => void
    ) => void;
  };
  await otsCall(client.deleteRow.bind(client), {
      tableName: HOLDINGS_TABLE,
      condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ holding_id: holdingId }],
  });

  return true;
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const snapshots = await scanTable(SNAPSHOTS_TABLE, "snapshot_date", normalizeSnapshot);
  return snapshots.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
}

export async function createSnapshot(input: SnapshotInput): Promise<Snapshot> {
  const client = getOtsClient();
  const snapshot: Snapshot = {
    ...input,
    created_at: input.created_at ?? nowIso(),
  };

  await otsCall(client.putRow.bind(client), {
    tableName: SNAPSHOTS_TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ snapshot_date: snapshot.snapshot_date }],
    attributeColumns: toAttributeColumns({
      total_value: snapshot.total_value,
      total_pnl: snapshot.total_pnl,
      total_dividend: snapshot.total_dividend,
      total_return: snapshot.total_return,
      created_at: snapshot.created_at,
    }),
  });

  return snapshot;
}

function isHoldingStale(holding: Holding): boolean {
  const risk = holding.risk_level ?? 0;
  if (risk < 3) return false;

  const updatedAt = holding.updated_at;
  if (!updatedAt) return false;

  const updatedMs = Date.parse(updatedAt);
  if (Number.isNaN(updatedMs)) return false;

  const daysSinceUpdate = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
  if (risk >= 4) return daysSinceUpdate > 30;
  if (risk === 3) return daysSinceUpdate > 90;
  return false;
}

function sumBreakdown(
  holdings: Holding[],
  getLabel: (holding: Holding) => string
): BreakdownStat[] {
  const map = new Map<string, number>();
  for (const holding of holdings) {
    const label = getLabel(holding);
    const value = holding.current_value ?? 0;
    map.set(label, (map.get(label) ?? 0) + value);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function computePortfolioStats(holdings: Holding[]): PortfolioStats {
  let totalValue = 0;
  let totalPnl = 0;
  let totalDividend = 0;
  let totalReturn = 0;
  let defensiveValue = 0;

  const riskMap = new Map<number, { value: number; count: number }>();

  for (const holding of holdings) {
    const value = holding.current_value ?? 0;
    const pnl = holding.unrealized_pnl ?? 0;
    const dividend = holding.cash_dividend ?? 0;
    const ret = holding.total_return ?? pnl + dividend;
    const risk = holding.risk_level ?? 0;

    totalValue += value;
    totalPnl += pnl;
    totalDividend += dividend;
    totalReturn += ret;

    if (risk === 1 || risk === 2) {
      defensiveValue += value;
    }

    if (risk >= 1 && risk <= 5) {
      const entry = riskMap.get(risk) ?? { value: 0, count: 0 };
      entry.value += value;
      entry.count += 1;
      riskMap.set(risk, entry);
    }
  }

  const byRiskLevel: RiskLevelStat[] = Array.from({ length: 5 }, (_, i) => {
    const level = i + 1;
    const entry = riskMap.get(level) ?? { value: 0, count: 0 };
    return { level, value: entry.value, count: entry.count };
  });

  const staleHoldingIds = holdings
    .filter(isHoldingStale)
    .map((h) => h.holding_id);

  return {
    totalValue,
    totalPnl,
    totalDividend,
    totalReturn,
    holdingCount: holdings.length,
    defensiveRatio: totalValue > 0 ? defensiveValue / totalValue : 0,
    byRiskLevel,
    byBank: sumBreakdown(holdings, (h) => h.bank?.trim() || "Unknown"),
    byAssetType: sumBreakdown(
      holdings,
      (h) => h.asset_type?.trim() || "other"
    ),
    staleHoldingIds,
  };
}
