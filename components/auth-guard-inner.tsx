"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSession } from "@/lib/session-client";

export function AuthGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    fetchSession().then((session) => {
      if (session?.user) setState("authed");
      else {
        setState("guest");
        router.replace("/auth/signin/");
      }
    });
  }, [router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (state === "guest") return null;

  return <>{children}</>;
}
