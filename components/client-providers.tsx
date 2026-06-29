"use client";

import { AppShell } from "@/components/app-shell";
import { SessionProvider } from "@/components/session-provider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
