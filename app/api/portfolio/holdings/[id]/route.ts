import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { deleteHolding, updateHolding } from "@/lib/ots/portfolio";

type RouteContext = { params: { id: string } };

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = context.params;

  try {
    const body = await request.json();

    if (body.risk_level !== undefined && (body.risk_level < 1 || body.risk_level > 5)) {
      return NextResponse.json({ error: "risk_level must be 1–5" }, { status: 400 });
    }

    const holding = await updateHolding(id, body);
    if (!holding) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }

    return NextResponse.json(holding);
  } catch (e) {
    console.error(`PUT /api/portfolio/holdings/${id}`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update holding" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = context.params;

  try {
    const deleted = await deleteHolding(id);
    if (!deleted) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/portfolio/holdings/${id}`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete holding" },
      { status: 500 }
    );
  }
}
