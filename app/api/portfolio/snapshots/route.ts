import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { createSnapshot, listSnapshots } from "@/lib/ots/portfolio";
import type { SnapshotInput } from "@/lib/types/portfolio";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOtsConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ snapshots: [] });
    }
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const snapshots = await listSnapshots();
    return NextResponse.json({ snapshots });
  } catch (e) {
    console.error("GET /api/portfolio/snapshots", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list snapshots" },
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
    const body = (await request.json()) as Partial<SnapshotInput>;

    if (!body.snapshot_date) {
      return NextResponse.json({ error: "snapshot_date is required" }, { status: 400 });
    }

    const snapshot = await createSnapshot({
      snapshot_date: body.snapshot_date,
      total_value: body.total_value,
      total_pnl: body.total_pnl,
      total_dividend: body.total_dividend,
      total_return: body.total_return,
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (e) {
    console.error("POST /api/portfolio/snapshots", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
