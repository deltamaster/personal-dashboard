"use client";

import { useState } from "react";

type Props = {
  callbackUrl?: string;
  className?: string;
  children: React.ReactNode;
};

export function MicrosoftSignInButton({
  callbackUrl = "/",
  className,
  children,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      const csrfRes = await fetch("/api/auth/csrf/");
      if (!csrfRes.ok) throw new Error("Failed to get CSRF token");
      const { csrfToken } = await csrfRes.json();

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signin/microsoft-entra-id/";

      for (const [name, value] of [
        ["csrfToken", csrfToken],
        ["callbackUrl", callbackUrl],
      ] as const) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch {
      setLoading(false);
      alert("Sign-in failed to start. Check the dev server console.");
    }
  }

  return (
    <button type="button" onClick={handleSignIn} disabled={loading} className={className}>
      {loading ? "Redirecting…" : children}
    </button>
  );
}
