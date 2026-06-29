"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClientSession } from "@/components/session-provider";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/movies/", label: "Movies" },
  { href: "/portfolio/", label: "Portfolio" },
  { href: "/travel/", label: "Travel" },
];

export function NavInner() {
  const pathname = usePathname();
  const { session } = useClientSession();

  if (!pathname || pathname.startsWith("/auth")) return null;

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <nav className="flex gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {session?.user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[var(--muted)] sm:inline">{session.user.name}</span>
            <a
              href="/api/auth/signout/"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Sign out
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
