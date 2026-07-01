"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MicrosoftSignInButton } from "@/components/microsoft-sign-in-button";

const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  AccessDenied: {
    title: "Access denied",
    detail:
      "This Microsoft account is not allowed, or we could not read an email from the sign-in response.",
  },
  OAuthCallback: {
    title: "Sign-in callback failed",
    detail:
      "The OAuth callback did not complete. Embedded browsers (e.g. Cursor Simple Browser) often drop PKCE/state cookies during the Microsoft redirect. Try Chrome, or sign in again after deploying the latest API.",
  },
  OAuthSignin: {
    title: "Could not start sign-in",
    detail: "Microsoft sign-in could not be started. Check API logs and try again.",
  },
  Configuration: {
    title: "Sign-in callback failed",
    detail:
      "The OAuth callback did not complete. Common causes: CDN cached an old redirect (fixed by redeploying API + Terraform), missing PKCE cookies in an embedded browser, or a server misconfiguration.",
  },
};

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams?.get("error") ?? "Unknown";
  const known = ERROR_MESSAGES[code];
  const title = known?.title ?? "Sign-in failed";
  const detail =
    known?.detail ??
    "Something went wrong during Microsoft sign-in. The error code is shown below.";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold text-red-400">{title}</h1>
      <p className="mt-4 text-[var(--muted)]">{detail}</p>
      <p className="mt-3 rounded-md bg-black/20 px-3 py-2 font-mono text-xs text-[var(--muted)]">
        error={code}
      </p>
      {code === "AccessDenied" && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Allowed account:{" "}
          <strong className="text-[var(--foreground)]">huhansen318@hotmail.com</strong>
          . If you already picked that account, the failure may be elsewhere — check the
          error code above.
        </p>
      )}
      {code === "OAuthCallback" && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Cursor&apos;s built-in browser does not share Chrome&apos;s Microsoft session and
          may not keep auth cookies through redirects. Use an external browser if this
          persists.
        </p>
      )}
      <MicrosoftSignInButton className="mt-8 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        Sign in with Microsoft
      </MicrosoftSignInButton>
    </div>
  );
}
