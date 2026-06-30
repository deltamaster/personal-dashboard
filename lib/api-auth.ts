import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getStubUser, isMicrosoftAuthEnabled } from "@/lib/auth-config";

export async function requireSession() {
  if (!isMicrosoftAuthEnabled()) {
    // Auth bypassed (QA/agent): treat every request as the allowlisted owner.
    return { session: { user: getStubUser() }, error: null };
  }

  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}
