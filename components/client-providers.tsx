"use client";

import { AppShell } from "@/components/app-shell";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
