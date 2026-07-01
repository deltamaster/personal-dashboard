"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { IosInputZoomFix } from "@/components/ios-input-zoom-fix";
import { SessionProvider } from "@/components/session-provider";
import { TrailingSlashRedirect } from "@/components/trailing-slash-redirect";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <TrailingSlashRedirect />
      </Suspense>
      <IosInputZoomFix />
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
