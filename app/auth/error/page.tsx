import { MicrosoftSignInButton } from "@/components/microsoft-sign-in-button";

export default function AuthErrorPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold text-red-400">Access denied</h1>
      <p className="mt-4 text-[var(--muted)]">
        Only <strong className="text-[var(--foreground)]">huhansen318@hotmail.com</strong>{" "}
        may sign in. Pick that account when Microsoft asks.
      </p>
      <MicrosoftSignInButton className="mt-8 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        Sign in with Microsoft
      </MicrosoftSignInButton>
    </div>
  );
}
