"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchSession, type ClientSession } from "@/lib/session-client";
import { getStubUser, isMicrosoftAuthEnabledClient } from "@/lib/auth-config";

export type SessionState = "unknown" | "authed" | "guest";

interface SessionContextValue {
  session: ClientSession | null;
  state: SessionState;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  state: "unknown",
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth") ?? false;
  const [session, setSession] = useState<ClientSession | null>(null);
  const [state, setState] = useState<SessionState>("unknown");

  useEffect(() => {
    if (!isMicrosoftAuthEnabledClient()) {
      setSession({ user: getStubUser() });
      setState("authed");
      return;
    }

    if (isAuthRoute) {
      setSession(null);
      setState("guest");
      return;
    }

    let cancelled = false;
    fetchSession().then((result) => {
      if (cancelled) return;
      setSession(result);
      setState(result?.user ? "authed" : "guest");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthRoute]);

  return (
    <SessionContext.Provider value={{ session, state }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useClientSession(): SessionContextValue {
  return useContext(SessionContext);
}
