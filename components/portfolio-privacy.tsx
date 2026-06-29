"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type PortfolioPrivacyContextValue = {
  amountsVisible: boolean;
  toggleAmountsVisible: () => void;
};

const PortfolioPrivacyContext = createContext<PortfolioPrivacyContextValue | null>(null);

export function PortfolioPrivacyProvider({ children }: { children: ReactNode }) {
  const [amountsVisible, setAmountsVisible] = useState(false);

  return (
    <PortfolioPrivacyContext.Provider
      value={{
        amountsVisible,
        toggleAmountsVisible: () => setAmountsVisible((v) => !v),
      }}
    >
      {children}
    </PortfolioPrivacyContext.Provider>
  );
}

export function usePortfolioPrivacy(): PortfolioPrivacyContextValue {
  const ctx = useContext(PortfolioPrivacyContext);
  if (!ctx) {
    throw new Error("usePortfolioPrivacy must be used within PortfolioPrivacyProvider");
  }
  return ctx;
}

function EyeOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 1l22 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PortfolioAmountsToggle() {
  const { amountsVisible, toggleAmountsVisible } = usePortfolioPrivacy();

  return (
    <button
      type="button"
      onClick={toggleAmountsVisible}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
      aria-label={amountsVisible ? "Hide amounts" : "Show amounts"}
      aria-pressed={amountsVisible}
      title={amountsVisible ? "Hide amounts" : "Show amounts"}
    >
      {amountsVisible ? <EyeOpenIcon /> : <EyeClosedIcon />}
    </button>
  );
}
