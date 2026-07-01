"use client";

import { NavInner } from "@/components/nav-inner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavInner />
      <main className="mx-auto min-w-0 max-w-6xl overflow-x-clip px-4 py-8">{children}</main>
    </>
  );
}
