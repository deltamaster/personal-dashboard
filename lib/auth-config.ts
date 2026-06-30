/**
 * Microsoft (Auth.js) authentication can be disabled via env var so the QA /
 * agent environment can run without the real OAuth flow.
 *
 * - Server: MICROSOFT_AUTH_ENABLED (default "true")
 * - Client (static export): NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED must mirror it,
 *   since browser code cannot read server-only env vars.
 *
 * When disabled, API handlers treat requests as the allowlisted owner and the
 * client session provider reports an authenticated stub — auth is bypassed.
 */
const DISABLED_VALUES = new Set(["false", "0", "no", "off"]);

function isEnabled(value: string | undefined): boolean {
  if (value === undefined || value === "") return true;
  return !DISABLED_VALUES.has(value.toLowerCase());
}

/** Server-side: is Microsoft auth enforced? */
export function isMicrosoftAuthEnabled(): boolean {
  return isEnabled(process.env.MICROSOFT_AUTH_ENABLED);
}

/** Client-side: is Microsoft auth enforced? (reads NEXT_PUBLIC_* build-time var) */
export function isMicrosoftAuthEnabledClient(): boolean {
  return isEnabled(process.env.NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED);
}

/** Stub identity used when auth is bypassed. */
export function getStubUser(): { name: string; email: string } {
  return {
    name: "QA User",
    email: (process.env.ALLOWED_USER_EMAIL ?? "huhansen318@hotmail.com").toLowerCase(),
  };
}
