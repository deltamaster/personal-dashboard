"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { pathnameNeedsTrailingSlash, withTrailingSlash } from "@/lib/trailing-slash";

/** Normalize App Router URLs to trailing-slash form (static OSS export). */
export function TrailingSlashRedirect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || !pathnameNeedsTrailingSlash(pathname)) return;
    const query = searchParams.toString();
    const href = `${withTrailingSlash(pathname)}${query ? `?${query}` : ""}`;
    router.replace(href);
  }, [pathname, searchParams, router]);

  return null;
}
