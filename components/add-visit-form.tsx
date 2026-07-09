"use client";

import { useState } from "react";
import { VISIT_TYPE_OPTIONS } from "@/lib/travel-visit-input";
import { postNewVisit } from "@/lib/visit-create-client";
import type { VisitCreateInput, VisitWithImages } from "@/lib/types/travel";

const inputClass =
  "mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export function AddVisitForm({ onAdded }: { onAdded: (visit: VisitWithImages) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const ratingRaw = String(form.get("rating") ?? "").trim();
    const body: VisitCreateInput = {
      date: String(form.get("date")),
      attraction: String(form.get("attraction")),
      city: String(form.get("city")),
      province: String(form.get("province")),
      type: String(form.get("type") || "景点"),
      country: String(form.get("country") || "中国"),
      rating: ratingRaw ? Number(ratingRaw) : undefined,
      thoughts: String(form.get("thoughts") || "") || undefined,
      highlights: String(form.get("highlights") || "") || undefined,
    };

    let visit: VisitWithImages;
    try {
      visit = await postNewVisit(body);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Failed to add visit");
      return;
    }

    setLoading(false);
    setOpen(false);
    onAdded(visit);
    (e.target as HTMLFormElement).reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Add visit
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-0 max-w-full space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <h3 className="font-medium">Add visit</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Date *
          <input name="date" type="date" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Type
          <select name="type" defaultValue="景点" className={inputClass}>
            {VISIT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          Attraction *
          <input name="attraction" required className={inputClass} />
        </label>
        <label className="block text-sm">
          City *
          <input name="city" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Province *
          <input name="province" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Country
          <input name="country" defaultValue="中国" className={inputClass} />
        </label>
        <label className="block text-sm">
          Rating
          <select name="rating" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} stars
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          Thoughts
          <textarea name="thoughts" rows={2} className={inputClass} />
        </label>
        <label className="block text-sm sm:col-span-2">
          Highlights
          <textarea name="highlights" rows={2} className={inputClass} />
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
