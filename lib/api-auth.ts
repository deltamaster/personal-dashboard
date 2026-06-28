import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}
