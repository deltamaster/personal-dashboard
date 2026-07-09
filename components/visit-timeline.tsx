"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VisitInsertForm } from "@/components/visit-insert-form";
import type { VisitInsertPosition } from "@/lib/visit-create-client";
import type { VisitImage, VisitWithImages } from "@/lib/types/travel";

function starCount(rating?: number): number {
  if (rating == null) return 0;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

function QuickRating({
  visitId,
  rating,
  saving,
  onRate,
}: {
  visitId: string;
  rating?: number;
  saving: boolean;
  onRate: (value: number) => void;
}) {
  const current = starCount(rating);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? current;

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={`Rate ${visitId}`}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={saving}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          aria-pressed={current === value}
          onMouseEnter={() => setHover(value)}
          onClick={() => onRate(value)}
          className={`text-lg leading-none transition-colors disabled:opacity-50 ${
            value <= active ? "text-amber-400" : "text-[var(--border)] hover:text-amber-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function readImageSize(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

async function uploadVisitPhoto(visitId: string, file: File): Promise<VisitImage> {
  // Single atomic call: the server uploads to OSS and records the row.
  const { width, height } = await readImageSize(file);
  const form = new FormData();
  form.append("file", file);
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));

  const res = await fetch(`/api/travel/visits/${visitId}/images/`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to add photo");
  }

  return res.json() as Promise<VisitImage>;
}

async function deleteVisitPhoto(visitId: string, imageId: string): Promise<void> {
  const res = await fetch(`/api/travel/visits/${visitId}/images/${imageId}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to delete photo");
  }
}

async function deleteVisit(visitId: string): Promise<void> {
  const res = await fetch(`/api/travel/visits/${visitId}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to delete visit");
  }
}

type VisitPatch = {
  rating?: number;
  date?: string;
  attraction?: string;
  city?: string;
  province?: string;
  thoughts?: string;
  highlights?: string;
};

const fieldInputClass =
  "rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm";

function EditPencilButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] disabled:opacity-40"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

async function patchVisit(visitId: string, patch: VisitPatch): Promise<VisitWithImages> {
  const res = await fetch(`/api/travel/visits/${visitId}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to save visit");
  }
  return res.json() as Promise<VisitWithImages>;
}

function VisitCard({
  visit,
  onVisitUpdated,
  onVisitDeleted,
}: {
  visit: VisitWithImages;
  onVisitUpdated?: (visit: VisitWithImages) => void;
  onVisitDeleted?: (visitId: string) => void;
}) {
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [attraction, setAttraction] = useState(visit.attraction);
  const [city, setCity] = useState(visit.city);
  const [province, setProvince] = useState(visit.province);
  const [date, setDate] = useState(visit.date);
  const [thoughts, setThoughts] = useState(visit.thoughts ?? "");
  const [highlights, setHighlights] = useState(visit.highlights ?? "");
  const [rating, setRating] = useState(visit.rating);
  const [images, setImages] = useState(visit.images);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingVisit, setDeletingVisit] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attractionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAttraction(visit.attraction);
    setCity(visit.city);
    setProvince(visit.province);
    setDate(visit.date);
    setThoughts(visit.thoughts ?? "");
    setHighlights(visit.highlights ?? "");
    setRating(visit.rating);
    setImages(visit.images);
    setEditing(false);
  }, [visit]);

  useEffect(() => {
    if (editing) attractionInputRef.current?.focus();
  }, [editing]);

  const location = [visit.city, visit.province, visit.country !== "中国" ? visit.country : null]
    .filter(Boolean)
    .join(" · ");

  function resetDrafts() {
    setAttraction(visit.attraction);
    setCity(visit.city);
    setProvince(visit.province);
    setDate(visit.date);
    setThoughts(visit.thoughts ?? "");
    setHighlights(visit.highlights ?? "");
  }

  function applyUpdated(apiVisit: VisitWithImages) {
    const merged: VisitWithImages = {
      ...visit,
      ...apiVisit,
      images: apiVisit.images ?? visit.images,
    };
    setAttraction(merged.attraction);
    setCity(merged.city);
    setProvince(merged.province);
    setDate(merged.date);
    setThoughts(merged.thoughts ?? "");
    setHighlights(merged.highlights ?? "");
    setRating(merged.rating);
    setImages(merged.images);
    onVisitUpdated?.(merged);
  }

  async function savePatch(patch: VisitPatch, rollback?: () => void) {
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await patchVisit(visit.visit_id, patch);
      applyUpdated(updated);
    } catch (e) {
      rollback?.();
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function handleRate(value: number) {
    const previous = rating;
    setRating(value);
    await savePatch({ rating: value }, () => setRating(previous));
  }

  function startEdit() {
    resetDrafts();
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    resetDrafts();
    setSaveError(null);
    setEditing(false);
  }

  function buildEditPatch(): VisitPatch {
    const patch: VisitPatch = {};
    const name = attraction.trim();
    const cityValue = city.trim();
    const provinceValue = province.trim();
    const dateValue = date.trim();
    const thoughtsValue = thoughts.trim();
    const highlightsValue = highlights.trim();

    if (name !== visit.attraction) patch.attraction = name;
    if (cityValue !== visit.city) patch.city = cityValue;
    if (provinceValue !== visit.province) patch.province = provinceValue;
    if (dateValue !== visit.date) patch.date = dateValue;
    if (thoughtsValue !== (visit.thoughts ?? "")) patch.thoughts = thoughtsValue;
    if (highlightsValue !== (visit.highlights ?? "")) patch.highlights = highlightsValue;

    return patch;
  }

  async function saveEdit() {
    const name = attraction.trim();
    const cityValue = city.trim();
    const provinceValue = province.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }
    if (!cityValue) {
      setSaveError("City is required");
      return;
    }
    if (!provinceValue) {
      setSaveError("Province is required");
      return;
    }

    const patch = buildEditPatch();
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    try {
      await savePatch(patch, resetDrafts);
      setEditing(false);
    } catch {
      // savePatch sets saveError
    }
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    setSaveError(null);
    setUploading(true);

    try {
      const added: VisitImage[] = [];
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith("image/")) continue;
        const image = await uploadVisitPhoto(visit.visit_id, file);
        added.push(image);
      }
      if (added.length === 0) {
        throw new Error("No valid images selected");
      }
      const updated: VisitWithImages = {
        ...visit,
        rating,
        images: [...images, ...added],
      };
      setImages(updated.images);
      onVisitUpdated?.(updated);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteVisit() {
    const label = visit.attraction || "this visit";
    if (typeof window !== "undefined" && !window.confirm(`Delete "${label}"? This cannot be undone.`)) {
      return;
    }
    setSaveError(null);
    setDeletingVisit(true);
    try {
      await deleteVisit(visit.visit_id);
      onVisitDeleted?.(visit.visit_id);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to delete visit");
    } finally {
      setDeletingVisit(false);
    }
  }

  async function handleDeletePhoto(imageId: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this photo?")) return;
    setSaveError(null);
    setDeletingId(imageId);
    try {
      await deleteVisitPhoto(visit.visit_id, imageId);
      const next = images.filter((img) => img.image_id !== imageId);
      setImages(next);
      onVisitUpdated?.({ ...visit, rating, images: next });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to delete photo");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 [content-visibility:auto] [contain-intrinsic-size:auto_12rem]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-3">
              <label className="block text-xs text-[var(--muted)]">
                Date
                <input
                  type="date"
                  value={date}
                  disabled={saving}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${fieldInputClass} mt-0.5 block w-full max-w-[11rem]`}
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Name
                <input
                  ref={attractionInputRef}
                  type="text"
                  value={attraction}
                  disabled={saving}
                  onChange={(e) => setAttraction(e.target.value)}
                  className={`${fieldInputClass} mt-0.5 block w-full`}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-[var(--muted)]">
                  City
                  <input
                    type="text"
                    value={city}
                    disabled={saving}
                    onChange={(e) => setCity(e.target.value)}
                    className={`${fieldInputClass} mt-0.5 block w-full`}
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Province
                  <input
                    type="text"
                    value={province}
                    disabled={saving}
                    onChange={(e) => setProvince(e.target.value)}
                    className={`${fieldInputClass} mt-0.5 block w-full`}
                  />
                </label>
              </div>
              <label className="block text-xs text-[var(--muted)]">
                Description
                <textarea
                  value={thoughts}
                  disabled={saving}
                  rows={3}
                  placeholder="Your notes…"
                  onChange={(e) => setThoughts(e.target.value)}
                  className={`${fieldInputClass} mt-0.5 w-full resize-y`}
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Highlights
                <textarea
                  value={highlights}
                  disabled={saving}
                  rows={2}
                  placeholder="What stood out?"
                  onChange={(e) => setHighlights(e.target.value)}
                  className={`${fieldInputClass} mt-0.5 w-full resize-y`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelEdit}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--muted)]">{visit.date}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <h3 className="font-semibold">{visit.attraction}</h3>
                <EditPencilButton
                  label="Edit visit"
                  disabled={saving}
                  onClick={startEdit}
                />
              </div>
              {visit.attraction_en && (
                <p className="text-sm text-[var(--muted)]">{visit.attraction_en}</p>
              )}
              <p className="mt-1 text-sm text-[var(--muted)]">{location}</p>
              {visit.thoughts && (
                <p className="mt-2 text-sm text-[var(--muted)]">{visit.thoughts}</p>
              )}
              {visit.highlights && (
                <p className="mt-2 text-sm">
                  <span className="text-[var(--muted)]">Highlights: </span>
                  {visit.highlights}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
            {visit.type}
          </span>
          <QuickRating
            visitId={visit.visit_id}
            rating={rating}
            saving={saving}
            onRate={(value) => void handleRate(value)}
          />
        </div>
      </div>

      {!editing && visit.tips && (
        <p className="mt-2 text-sm">
          <span className="text-[var(--muted)]">Tips: </span>
          {visit.tips}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-4 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))]">
          {images.map((image) =>
            image.oss_url ? (
              <div
                key={image.image_id}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--border)]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedPhoto(image.oss_url)}
                  className="block h-full w-full"
                  aria-label="View photo"
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
                <button
                  type="button"
                  onClick={() => void handleDeletePhoto(image.image_id)}
                  disabled={deletingId === image.image_id}
                  aria-label="Delete photo"
                  title="Delete photo"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                >
                  {deletingId === image.image_id ? (
                    <span className="text-[10px]">…</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => void handleFilesSelected(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading || deletingVisit}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)] disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Add photos"}
        </button>
        <button
          type="button"
          disabled={saving || uploading || deletingVisit}
          onClick={() => void handleDeleteVisit()}
          className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 disabled:opacity-50"
        >
          {deletingVisit ? "Deleting…" : "Delete visit"}
        </button>
        {saving && <span className="text-xs text-[var(--muted)]">Saving…</span>}
      </div>

      {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}

      {expandedPhoto &&
        typeof document !== "undefined" &&
        // Portal to <body>: the card uses `content-visibility:auto` (CSS
        // containment), which would otherwise make `position: fixed` resolve
        // against the card instead of the viewport, shrinking the lightbox.
        createPortal(
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
          </div>,
          document.body
        )}
    </article>
  );
}

function VisitInsertButton({
  label,
  onClick,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-base leading-none text-[var(--muted)] shadow-sm transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
    >
      +
    </button>
  );
}

type InsertSlot = VisitInsertPosition;

function VisitTimelineRow({
  visit,
  showInsertOnTap,
  insertSlot,
  onRowActivate,
  onInsertClick,
  onInsertSaved,
  onInsertCancel,
  onVisitUpdated,
  onVisitDeleted,
}: {
  visit: VisitWithImages;
  showInsertOnTap: boolean;
  insertSlot: InsertSlot | null;
  onRowActivate: (visitId: string) => void;
  onInsertClick: (visit: VisitWithImages, position: InsertSlot["position"]) => void;
  onInsertSaved: (visit: VisitWithImages, position: InsertSlot) => void;
  onInsertCancel: () => void;
  onVisitUpdated?: (visit: VisitWithImages) => void;
  onVisitDeleted?: (visitId: string) => void;
}) {
  const insertAbove =
    insertSlot?.anchorVisitId === visit.visit_id && insertSlot.position === "above";
  const insertBelow =
    insertSlot?.anchorVisitId === visit.visit_id && insertSlot.position === "below";
  const showInsertControls = !insertSlot && showInsertOnTap;

  const insertBtnVisibility = showInsertControls
    ? "flex"
    : insertSlot
      ? "hidden"
      : "hidden group-hover/row:flex";

  function handleRowClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, textarea, select, label, [role='dialog']")) return;
    onRowActivate(visit.visit_id);
  }

  return (
    <div
      data-visit-row
      className="group/row relative py-3"
      onClick={handleRowClick}
    >
      {!insertSlot && (
        <div
          className={`pointer-events-none absolute -top-3 left-0 right-0 z-10 justify-center ${insertBtnVisibility}`}
        >
          <div className="pointer-events-auto">
            <VisitInsertButton
              label="Add visit above"
              onClick={(e) => {
                e.stopPropagation();
                onInsertClick(visit, "above");
              }}
            />
          </div>
        </div>
      )}

      {insertAbove && (
        <div className="mb-3">
          <VisitInsertForm
            template={visit}
            onSaved={(created) =>
              onInsertSaved(created, { anchorVisitId: visit.visit_id, position: "above" })
            }
            onCancel={onInsertCancel}
          />
        </div>
      )}

      <VisitCard
        visit={visit}
        onVisitUpdated={onVisitUpdated}
        onVisitDeleted={onVisitDeleted}
      />

      {insertBelow && (
        <div className="mt-3">
          <VisitInsertForm
            template={visit}
            onSaved={(created) =>
              onInsertSaved(created, { anchorVisitId: visit.visit_id, position: "below" })
            }
            onCancel={onInsertCancel}
          />
        </div>
      )}

      {!insertSlot && (
        <div
          className={`pointer-events-none absolute -bottom-3 left-0 right-0 z-10 justify-center ${insertBtnVisibility}`}
        >
          <div className="pointer-events-auto">
            <VisitInsertButton
              label="Add visit below"
              onClick={(e) => {
                e.stopPropagation();
                onInsertClick(visit, "below");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function VisitTimeline({
  visits,
  onVisitUpdated,
  onVisitDeleted,
  onVisitAdded,
}: {
  visits: VisitWithImages[];
  onVisitUpdated?: (visit: VisitWithImages) => void;
  onVisitDeleted?: (visitId: string) => void;
  onVisitAdded?: (visit: VisitWithImages, relative?: VisitInsertPosition) => void;
}) {
  const [tappedVisitId, setTappedVisitId] = useState<string | null>(null);
  const [insertSlot, setInsertSlot] = useState<InsertSlot | null>(null);
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setCoarsePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!tappedVisitId) return;
    function onDocumentClick(e: MouseEvent) {
      if (!(e.target as Element).closest("[data-visit-row]")) {
        setTappedVisitId(null);
      }
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [tappedVisitId]);

  const grouped = useMemo(() => {
    const map = new Map<string, VisitWithImages[]>();
    for (const visit of visits) {
      const year = (visit.date ?? "").slice(0, 4) || "0000";
      const list = map.get(year) ?? [];
      list.push(visit);
      map.set(year, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [visits]);

  if (visits.length === 0) {
    return <p className="text-[var(--muted)]">No visits recorded yet.</p>;
  }

  function handleRowActivate(visitId: string) {
    if (!coarsePointer) return;
    setTappedVisitId((current) => (current === visitId ? null : visitId));
  }

  function handleInsertClick(visit: VisitWithImages, position: InsertSlot["position"]) {
    setInsertSlot({ anchorVisitId: visit.visit_id, position });
    setTappedVisitId(null);
  }

  function handleInsertSaved(visit: VisitWithImages, relative: InsertSlot) {
    setInsertSlot(null);
    setTappedVisitId(null);
    onVisitAdded?.(visit, relative);
  }

  function handleInsertCancel() {
    setInsertSlot(null);
  }

  return (
    <div className="space-y-8">
      {grouped.map(([year, yearVisits]) => (
        <section key={year}>
          <h2 className="mb-4 text-lg font-semibold">{year}</h2>
          <div className="space-y-4 border-l border-[var(--border)] pl-4 sm:pl-6">
            {yearVisits.map((visit) => (
              <VisitTimelineRow
                key={visit.visit_id}
                visit={visit}
                showInsertOnTap={coarsePointer && tappedVisitId === visit.visit_id}
                insertSlot={insertSlot}
                onRowActivate={handleRowActivate}
                onInsertClick={handleInsertClick}
                onInsertSaved={handleInsertSaved}
                onInsertCancel={handleInsertCancel}
                onVisitUpdated={onVisitUpdated}
                onVisitDeleted={onVisitDeleted}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
