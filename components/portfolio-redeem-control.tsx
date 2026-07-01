"use client";

import { useState } from "react";
import type { Holding } from "@/lib/types/portfolio";
import {
  canRedeemImmediately,
  formatRedeemDateLabel,
  isScheduledRedemptionPending,
  redeemDateDefaultHint,
  suggestRedeemDate,
} from "@/lib/portfolio-redeem";

export function ScheduledRedeemBadge({ holding }: { holding: Holding }) {
  const at = holding.scheduled_redeem_at?.trim();
  if (!isScheduledRedemptionPending(holding) || !at) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-200">
      Redeeming {formatRedeemDateLabel(at)}
    </span>
  );
}

export function RedeemHoldingButton({
  holding,
  onRedeemed,
  disabled,
}: {
  holding: Holding;
  onRedeemed: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [redeemAt, setRedeemAt] = useState(() => suggestRedeemDate(holding));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const immediate = canRedeemImmediately(holding);
  const pending = isScheduledRedemptionPending(holding);
  const dateHint = redeemDateDefaultHint(holding);

  async function submitImmediate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/holdings/${holding.holding_id}/redeem/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setOpen(false);
      await onRedeemed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redeem failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitSchedule() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/holdings/${holding.holding_id}/redeem/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeem_at: redeemAt }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setOpen(false);
      await onRedeemed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule failed");
    } finally {
      setBusy(false);
    }
  }

  if (pending) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setRedeemAt(suggestRedeemDate(holding));
          setError(null);
          setOpen(true);
        }}
        className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
      >
        Redeem
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`redeem-title-${holding.holding_id}`}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={`redeem-title-${holding.holding_id}`}
              className="text-lg font-semibold"
            >
              Redeem {holding.name}
            </h3>

            {immediate ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                This holding can be redeemed immediately. Its value will be set to zero and
                it will disappear from your active holdings.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  This product cannot be redeemed immediately. Choose the expected redemption
                  date — the holding will zero out automatically on that day.
                </p>
                <label className="mt-4 block min-w-0 text-sm">
                  <span className="text-[var(--muted)]">Expected redemption date</span>
                  {dateHint && (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{dateHint}</span>
                  )}
                  <input
                    type="date"
                    value={redeemAt}
                    onChange={(e) => setRedeemAt(e.target.value)}
                    className="mt-1 box-border block w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 [color-scheme:dark]"
                  />
                </label>
              </>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
              {immediate ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitImmediate()}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Redeeming…" : "Redeem now"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !redeemAt}
                  onClick={() => void submitSchedule()}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Schedule redemption"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
