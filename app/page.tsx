"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";

export default function HomePage() {
  return (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">Personal Dashboard</h1>
        <p className="mt-2 text-[var(--muted)]">Welcome back.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { href: "/movies/", label: "Movies", desc: "Watch log & director stats" },
            { href: "/portfolio/", label: "Portfolio", desc: "Holdings, risk & NAV" },
            { href: "/travel/", label: "Travel", desc: "Visits, photos & journey stats" },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--accent)]"
            >
              <h2 className="font-semibold">{label}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
