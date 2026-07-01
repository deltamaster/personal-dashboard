"use client";

import { AppShell } from "@/components/app-shell";
import { IosInputZoomFix } from "@/components/ios-input-zoom-fix";
import { SessionProvider } from "@/components/session-provider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IosInputZoomFix />
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
