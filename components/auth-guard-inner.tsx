"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { fetchSession } from "@/lib/session-client";

export function AuthGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    fetchSession().then((session) => {
      if (session?.user) setState("authed");
      else {
        setState("guest");
        if (!pathname?.startsWith("/auth")) {
          router.replace("/auth/signin/");
        }
      }
    });
  }, [pathname, router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (state === "guest") return <SignInPrompt />;

  return <>{children}</>;
}
