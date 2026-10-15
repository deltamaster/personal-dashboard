"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { SingerField, type SingerFieldHandle } from "@/components/singer-field";
import { OTS_FETCH_INIT, useOtsCache } from "@/lib/use-ots-cache";
import type { Song } from "@/lib/types/song";

const inputClass =
  "mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base";

type Visibility = "all" | "public" | "learning" | "hidden";

const SONG_TAGS = [
  { id: "learning", label: "Learning" },
  { id: "hidden", label: "Hidden" },
] as const;

const UNLISTED_TAGS = new Set<string>(SONG_TAGS.map((tag) => tag.id));

function isPublicSong(song: Song): boolean {
  return !(song.tags ?? []).some((tag) => UNLISTED_TAGS.has(tag));
}

function TagToggle({
  tag,
  label,
  active,
  disabled,
  onClick,
}: {
  tag: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const color = tag === "learning" ? "bg-amber-700 text-amber-50" : "bg-rose-800 text-rose-50";
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${color} ${
        active ? "" : "grayscale opacity-40"
      }`}
    >
      {label}
    </button>
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : fallback;
}

function SongEditor({
  song,
  onChanged,
  onDeleted,
}: {
  song: Song;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(song.name);
  const [singers, setSingers] = useState(song.singers);
  const singerField = useRef<SingerFieldHandle>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = song.tags ?? [];

  async function saveEdit() {
    setBusy(true);
    setError(null);
    const nextSingers = singerField.current?.getSingers() ?? singers;
    if (!nextSingers.length) {
      setBusy(false);
      setError("Enter at least one singer");
      return;
    }
    const res = await fetch(`/api/songs/${encodeURIComponent(song.id)}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, singers: nextSingers }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await readError(res, "Failed to save song"));
      return;
    }
    setEditing(false);
    await onChanged();
  }

  async function setTags(tags: string[]) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/songs/${encodeURIComponent(song.id)}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await readError(res, "Failed to update song"));
      return;
    }
    await onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete “${song.name}”? This removes it from the public list.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/songs/${encodeURIComponent(song.id)}/`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await readError(res, "Failed to delete song"));
      return;
    }
    await onDeleted();
  }

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      {editing ? (
        <div className="space-y-3">
          <label className="block text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <div className="block text-sm">
            Singers
            <SingerField
              ref={singerField}
              singers={singers}
              onChange={setSingers}
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveEdit()}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setName(song.name);
                setSingers(song.singers);
                setError(null);
                setEditing(false);
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{song.name}</h2>
              {SONG_TAGS.map((tag) => (
                <TagToggle
                  key={tag.id}
                  tag={tag.id}
                  label={tag.label}
                  active={tags.includes(tag.id)}
                  disabled={busy}
                  onClick={() =>
                    void setTags(
                      tags.includes(tag.id) ? tags.filter((item) => item !== tag.id) : [...tags, tag.id]
                    )
                  }
                />
              ))}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{song.singers.join("、")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-300"
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </li>
  );
}

export function SongsManager() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [singerChips, setSingerChips] = useState<string[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const singerField = useRef<SingerFieldHandle>(null);

  const fetchSongs = useCallback(async (): Promise<Song[]> => {
    const res = await fetch("/api/songs/", OTS_FETCH_INIT);
    if (!res.ok) throw new Error(await readError(res, `HTTP ${res.status}`));
    const body = await res.json();
    return Array.isArray(body.songs) ? body.songs : [];
  }, []);

  const { data, loading, error, refresh } = useOtsCache("songs", fetchSongs);
  const songs = data ?? [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs
      .filter((song) => {
        if (visibility === "public" && !isPublicSong(song)) return false;
        if (visibility === "learning" && !(song.tags ?? []).includes("learning")) return false;
        if (visibility === "hidden" && !(song.tags ?? []).includes("hidden")) return false;
        if (!q) return true;
        return (
          song.name.toLowerCase().includes(q) ||
          song.singers.some((singer) => singer.toLowerCase().includes(q))
        );
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "zh"));
  }, [songs, query, visibility]);

  async function addSong(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const singers = singerField.current?.getSingers() ?? singerChips;
    if (!singers.length) {
      setSaving(false);
      setFormError("Enter at least one singer");
      return;
    }
    const res = await fetch("/api/songs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        singers,
        tags: draftTags,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(await readError(res, "Failed to add song"));
      return;
    }
    setSingerChips([]);
    setDraftTags([]);
    setOpen(false);
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">歌单</h1>
          <p className="mt-1 text-[var(--muted)]">
            Edits the public list at{" "}
            <a className="underline" href="https://www.huhansen.cn/songs/" target="_blank" rel="noreferrer">
              www.huhansen.cn/songs
            </a>
            . Click Learning or Hidden beside a title. Gray means off. Either tag keeps the song off the public page.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Add song
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={(e) => void addSong(e)}
          className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2 className="font-medium">Add song</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Name *
              <input name="name" required className={inputClass} />
            </label>
            <div className="block text-sm">
              Singers *
              <SingerField ref={singerField} singers={singerChips} onChange={setSingerChips} disabled={saving} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {SONG_TAGS.map((tag) => (
              <TagToggle
                key={tag.id}
                tag={tag.id}
                label={tag.label}
                active={draftTags.includes(tag.id)}
                disabled={saving}
                onClick={() =>
                  setDraftTags((current) =>
                    current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id]
                  )
                }
              />
            ))}
          </div>
          {formError && <p className="text-sm text-red-300">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSingerChips([]);
                setDraftTags([]);
                setOpen(false);
                setFormError(null);
              }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-[var(--muted)]">Loading…</p>}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>
      )}

      {!loading && !error && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or singer"
            aria-label="Search name or singer"
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base"
          />
          {(
            [
              ["all", "All"],
              ["public", "Public"],
              ["learning", "Learning"],
              ["hidden", "Hidden"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setVisibility(value)}
              className={`rounded-lg px-3 py-2 text-sm ${
                visibility === value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && songs.length === 0 && (
        <p className="text-[var(--muted)]">No songs yet. Add the first one above.</p>
      )}
      {!loading && !error && songs.length > 0 && visible.length === 0 && (
        <p className="text-[var(--muted)]">No songs match.</p>
      )}

      <ul className="space-y-3">
        {visible.map((song) => (
          <SongEditor key={song.id} song={song} onChanged={refresh} onDeleted={refresh} />
        ))}
      </ul>
    </div>
  );
}
