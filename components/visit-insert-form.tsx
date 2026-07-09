"use client";

import { useEffect, useRef, useState } from "react";
import { VISIT_TYPE_OPTIONS } from "@/lib/travel-visit-input";
import { postNewVisit, visitCreateTemplateFromVisit } from "@/lib/visit-create-client";
import type { VisitCreateInput, VisitWithImages } from "@/lib/types/travel";

const fieldInputClass =
  "mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm";

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
  const defaults = visitCreateTemplateFromVisit(template);
  const [date, setDate] = useState(defaults.date);
  const [type, setType] = useState(defaults.type ?? "景点");
  const [attraction, setAttraction] = useState("");
  const [attractionEn, setAttractionEn] = useState(defaults.attraction_en ?? "");
  const [city, setCity] = useState(defaults.city);
  const [province, setProvince] = useState(defaults.province);
  const [country, setCountry] = useState(defaults.country ?? "中国");
  const [thoughts, setThoughts] = useState(defaults.thoughts ?? "");
  const [highlights, setHighlights] = useState(defaults.highlights ?? "");
  const [tips, setTips] = useState(defaults.tips ?? "");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attractionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    attractionRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = attraction.trim();
    const cityValue = city.trim();
    const provinceValue = province.trim();

    if (!name) {
      setError("Attraction name is required");
      return;
    }
    if (!cityValue) {
      setError("City is required");
      return;
    }
    if (!provinceValue) {
      setError("Province is required");
      return;
    }

    setLoading(true);
    setError(null);

    const body: VisitCreateInput = {
      date,
      type,
      attraction: name,
      attraction_en: attractionEn.trim() || undefined,
      city: cityValue,
      province: provinceValue,
      country: country.trim() || "中国",
      thoughts: thoughts.trim() || undefined,
      highlights: highlights.trim() || undefined,
      tips: tips.trim() || undefined,
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
      <p className="text-xs font-medium text-[var(--muted)]">New visit (copied from nearby)</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-[var(--muted)]">
          Date *
          <input
            type="date"
            value={date}
            disabled={loading}
            required
            onChange={(e) => setDate(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Type
          <select
            value={type}
            disabled={loading}
            onChange={(e) => setType(e.target.value)}
            className={fieldInputClass}
          >
            {VISIT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--muted)] sm:col-span-2">
          Attraction *
          <input
            ref={attractionRef}
            type="text"
            value={attraction}
            disabled={loading}
            placeholder="Attraction name"
            onChange={(e) => setAttraction(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <label className="block text-xs text-[var(--muted)] sm:col-span-2">
          English name
          <input
            type="text"
            value={attractionEn}
            disabled={loading}
            onChange={(e) => setAttractionEn(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          City *
          <input
            type="text"
            value={city}
            disabled={loading}
            onChange={(e) => setCity(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Province *
          <input
            type="text"
            value={province}
            disabled={loading}
            onChange={(e) => setProvince(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Country
          <input
            type="text"
            value={country}
            disabled={loading}
            onChange={(e) => setCountry(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <div className="block text-xs text-[var(--muted)]">
          Rating
          <div className="mt-1">
            <OptionalRating value={rating} onChange={setRating} disabled={loading} />
          </div>
        </div>
        <label className="block text-xs text-[var(--muted)] sm:col-span-2">
          Thoughts
          <textarea
            value={thoughts}
            disabled={loading}
            rows={2}
            onChange={(e) => setThoughts(e.target.value)}
            className={`${fieldInputClass} resize-y`}
          />
        </label>
        <label className="block text-xs text-[var(--muted)] sm:col-span-2">
          Highlights
          <textarea
            value={highlights}
            disabled={loading}
            rows={2}
            onChange={(e) => setHighlights(e.target.value)}
            className={`${fieldInputClass} resize-y`}
          />
        </label>
        <label className="block text-xs text-[var(--muted)] sm:col-span-2">
          Tips
          <textarea
            value={tips}
            disabled={loading}
            rows={2}
            onChange={(e) => setTips(e.target.value)}
            className={`${fieldInputClass} resize-y`}
          />
        </label>
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
