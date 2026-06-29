import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import {
  getDummyPortfolioHoldingsData,
  shouldUsePortfolioDummyData,
} from "@/lib/portfolio-dummy-data";
import { filterActiveHoldings } from "@/lib/portfolio-format";
import {
  computePortfolioStats,
  createHolding,
  listHoldings,
} from "@/lib/ots/portfolio";
import type { HoldingInput } from "@/lib/types/portfolio";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (shouldUsePortfolioDummyData()) {
    return NextResponse.json(getDummyPortfolioHoldingsData());
  }

  if (!isOtsConfigured()) {
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const holdings = filterActiveHoldings(await listHoldings());
    const stats = computePortfolioStats(holdings);
    return NextResponse.json({ holdings, stats });
  } catch (e) {
    console.error("GET /api/portfolio/holdings", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list holdings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOtsConfigured()) {
    return NextResponse.json(
      { error: "OTS is not configured — add Alibaba credentials to .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as Partial<HoldingInput>;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const risk = body.risk_level;
    if (risk != null && (risk < 1 || risk > 5)) {
      return NextResponse.json({ error: "risk_level must be 1–5" }, { status: 400 });
    }

    const holding = await createHolding({
      holding_id: body.holding_id,
      name: body.name.trim(),
      name_en: body.name_en?.trim(),
      ticker: body.ticker?.trim(),
      issuer: body.issuer?.trim(),
      bank: body.bank?.trim(),
      asset_type: body.asset_type,
      risk_level: risk,
      currency: body.currency,
      quantity: body.quantity,
      purchase_nav: body.purchase_nav,
      current_nav: body.current_nav,
      purchase_amount: body.purchase_amount,
      current_value: body.current_value,
      cash_dividend: body.cash_dividend,
      coupon_rate: body.coupon_rate,
      knockin_level: body.knockin_level,
      autocall_level: body.autocall_level,
      strike_level: body.strike_level,
      maturity: body.maturity,
      purchase_date: body.purchase_date,
      notes: body.notes,
    });

    return NextResponse.json(holding, { status: 201 });
  } catch (e) {
    console.error("POST /api/portfolio/holdings", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create holding" },
      { status: 500 }
    );
  }
}
