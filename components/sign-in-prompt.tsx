import { MicrosoftSignInButton } from "@/components/microsoft-sign-in-button";

export function SignInPrompt() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold">Personal Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">Sign in with your Microsoft account</p>
      <MicrosoftSignInButton className="mt-8 flex items-center gap-2 rounded-lg bg-[#2f2f2f] px-6 py-3 text-sm font-medium text-white hover:bg-[#3f3f3f] disabled:opacity-50">
        <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden>
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        Sign in with Microsoft
      </MicrosoftSignInButton>
    </div>
  );
}
