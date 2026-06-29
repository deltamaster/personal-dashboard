"use client";

import { useMemo, useState } from "react";
import type { VisitWithImages } from "@/lib/types/travel";

function starCount(rating?: number): number {
  if (rating == null) return 0;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

function Stars({ rating }: { rating?: number }) {
  const n = starCount(rating);
  if (n === 0) return null;
  return (
    <span className="text-amber-400" aria-label={`${n} stars`}>
      {"★".repeat(n)}
    </span>
  );
}

function VisitCard({ visit }: { visit: VisitWithImages }) {
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const location = [visit.city, visit.province, visit.country !== "中国" ? visit.country : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 [content-visibility:auto] [contain-intrinsic-size:auto_12rem]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-[var(--muted)]">{visit.date}</p>
          <h3 className="mt-1 font-semibold">{visit.attraction}</h3>
          {visit.attraction_en && (
            <p className="text-sm text-[var(--muted)]">{visit.attraction_en}</p>
          )}
          <p className="mt-1 text-sm text-[var(--muted)]">{location}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
            {visit.type}
          </span>
          <Stars rating={visit.rating} />
        </div>
      </div>

      {visit.highlights && (
        <p className="mt-3 text-sm">
          <span className="text-[var(--muted)]">Highlights: </span>
          {visit.highlights}
        </p>
      )}
      {visit.thoughts && (
        <p className="mt-2 text-sm text-[var(--muted)]">{visit.thoughts}</p>
      )}
      {visit.tips && (
        <p className="mt-2 text-sm">
          <span className="text-[var(--muted)]">Tips: </span>
          {visit.tips}
        </p>
      )}

      {visit.images.length > 0 && (
        <div className="mt-4 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))]">
          {visit.images.map((image) =>
            image.oss_url ? (
              <button
                key={image.image_id}
                type="button"
                onClick={() => setExpandedPhoto(image.oss_url)}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--border)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.oss_url}
                  alt={image.description ?? visit.attraction}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            ) : (
              <div
                key={image.image_id}
                className="flex aspect-[4/3] items-center justify-center rounded-lg bg-[var(--border)] px-2 text-center text-xs text-[var(--muted)]"
              >
                Photo unavailable
              </div>
            )
          )}
        </div>
      )}

      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setExpandedPhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedPhoto}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}

export function VisitTimeline({ visits }: { visits: VisitWithImages[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, VisitWithImages[]>();
    for (const visit of visits) {
      const year = visit.date.slice(0, 4);
      const list = map.get(year) ?? [];
      list.push(visit);
      map.set(year, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [visits]);

  if (visits.length === 0) {
    return <p className="text-[var(--muted)]">No visits recorded yet.</p>;
  }

  return (
    <div className="space-y-8">
      {grouped.map(([year, yearVisits]) => (
        <section key={year}>
          <h2 className="mb-4 text-lg font-semibold">{year}</h2>
          <div className="space-y-4 border-l border-[var(--border)] pl-4 sm:pl-6">
            {yearVisits.map((visit) => (
              <VisitCard key={visit.visit_id} visit={visit} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
