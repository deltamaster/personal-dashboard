import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import {
  canRedeemImmediately,
  validateScheduleRedeemDate,
} from "@/lib/portfolio-redeem";
import {
  redeemDummyHolding,
  scheduleDummyRedemption,
  shouldUsePortfolioDummyData,
} from "@/lib/portfolio-dummy-data";
import {
  executeRedemption,
  getHolding,
  scheduleRedemption,
} from "@/lib/ots/portfolio";

type RouteContext = { params: { id: string } };

/**
 * Redeem a holding: immediate zero-out, or schedule redemption for a future date.
 * Scheduled holdings auto-zero when listHoldings runs after the date passes.
 */
export async function POST(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = context.params;

  try {
    const body = (await request.json()) as { immediate?: boolean; redeem_at?: string };

    if (shouldUsePortfolioDummyData()) {
      if (body.immediate) {
        const holding = redeemDummyHolding(id);
        if (!holding) {
          return NextResponse.json({ error: "Holding not found" }, { status: 404 });
        }
        return NextResponse.json(holding);
      }
      if (body.redeem_at) {
        const err = validateScheduleRedeemDate(body.redeem_at);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        const holding = scheduleDummyRedemption(id, body.redeem_at);
        if (!holding) {
          return NextResponse.json({ error: "Holding not found" }, { status: 404 });
        }
        return NextResponse.json(holding);
      }
      return NextResponse.json(
        { error: "Provide immediate: true or redeem_at (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (!isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }

    const existing = await getHolding(id);
    if (!existing || (existing.current_value ?? 0) <= 0) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }

    if (body.immediate) {
      if (!canRedeemImmediately(existing)) {
        return NextResponse.json(
          { error: "This holding cannot be redeemed immediately — schedule a date instead." },
          { status: 400 }
        );
      }
      const holding = await executeRedemption(id);
      return NextResponse.json(holding);
    }

    if (body.redeem_at) {
      const err = validateScheduleRedeemDate(body.redeem_at);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      const holding = await scheduleRedemption(id, body.redeem_at);
      return NextResponse.json(holding);
    }

    return NextResponse.json(
      { error: "Provide immediate: true or redeem_at (YYYY-MM-DD)" },
      { status: 400 }
    );
  } catch (e) {
    console.error(`POST /api/portfolio/holdings/${id}/redeem`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to redeem holding" },
      { status: 500 }
    );
  }
}
