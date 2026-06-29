"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClientSession } from "@/components/session-provider";

export function AuthGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useClientSession();

  useEffect(() => {
    if (state === "guest" && pathname && !pathname.startsWith("/auth")) {
      router.replace("/auth/signin/");
    }
  }, [state, pathname, router]);

  return <>{children}</>;
}
