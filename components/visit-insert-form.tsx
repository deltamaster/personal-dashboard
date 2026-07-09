"use client";

import { useEffect, useRef, useState } from "react";
import { postNewVisit, visitCreateTemplateFromVisit } from "@/lib/visit-create-client";
import type { VisitCreateInput, VisitWithImages } from "@/lib/types/travel";

const fieldInputClass =
  "rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm";

function OptionalRating({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label="Rating (optional)"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value === n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? undefined : n)}
          className={`text-lg leading-none transition-colors disabled:opacity-50 ${
            n <= active ? "text-amber-400" : "text-[var(--border)] hover:text-amber-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function VisitInsertForm({
  template,
  onSaved,
  onCancel,
}: {
  template: VisitWithImages;
  onSaved: (visit: VisitWithImages) => void;
  onCancel: () => void;
}) {
  const base = visitCreateTemplateFromVisit(template);
  const [attraction, setAttraction] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const contextLabel = [
    template.date,
    template.city,
    template.province,
    template.country !== "中国" ? template.country : null,
    template.type,
  ]
    .filter(Boolean)
    .join(" · ");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = attraction.trim();
    if (!name) {
      setError("Attraction name is required");
      return;
    }

    setLoading(true);
    setError(null);

    const body: VisitCreateInput = {
      ...base,
      attraction: name,
      rating,
    };

    try {
      const visit = await postNewVisit(body);
      onSaved(visit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add visit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-lg border border-dashed border-[var(--accent)] bg-[var(--card)] p-3 shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-[var(--muted)]">{contextLabel}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={attraction}
          disabled={loading}
          placeholder="Attraction name *"
          onChange={(e) => setAttraction(e.target.value)}
          className={`${fieldInputClass} min-w-0 flex-1`}
        />
        <OptionalRating value={rating} onChange={setRating} disabled={loading} />
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Add"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
