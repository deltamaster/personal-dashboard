"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { consumeSingerDraft, withCommittedDraft } from "../functions/www-songs/singer-tokens.js";

export type SingerFieldHandle = {
  getSingers: () => string[];
};

export const SingerField = forwardRef<
  SingerFieldHandle,
  {
    singers: string[];
    onChange: (singers: string[]) => void;
    disabled?: boolean;
  }
>(function SingerField({ singers, onChange, disabled }, ref) {
  const [draft, setDraft] = useState("");
  const singersRef = useRef(singers);
  const draftRef = useRef(draft);
  singersRef.current = singers;
  draftRef.current = draft;

  useImperativeHandle(ref, () => ({
    getSingers: () => withCommittedDraft(singersRef.current, draftRef.current),
  }));

  function applyDraft(value: string) {
    const next = consumeSingerDraft(value);
    const chips = singersRef.current.concat(next.chips);
    if (next.chips.length) {
      singersRef.current = chips;
      onChange(chips);
    }
    draftRef.current = next.draft;
    setDraft(next.draft);
  }

  function removeChip(index: number) {
    const next = singersRef.current.filter((_, chipIndex) => chipIndex !== index);
    singersRef.current = next;
    onChange(next);
  }

  return (
    <div
      className="mt-1 flex min-h-11 flex-wrap items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 focus-within:border-[var(--accent)]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.currentTarget.querySelector("input")?.focus();
        }
      }}
    >
      {singers.map((singer, index) => (
        <span
          key={`${singer}-${index}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--border)] px-2 py-0.5 text-sm"
        >
          <span className="truncate">{singer}</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${singer}`}
            className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => removeChip(index)}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        disabled={disabled}
        aria-label="Singers"
        placeholder={singers.length ? "" : "周杰伦 / 方文山"}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-base outline-none disabled:opacity-40"
        onChange={(event) => applyDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Backspace" && draftRef.current === "" && singersRef.current.length > 0) {
            event.preventDefault();
            removeChip(singersRef.current.length - 1);
          }
        }}
        onBlur={() => {
          const name = draftRef.current.trim();
          if (!name) {
            draftRef.current = "";
            setDraft("");
            return;
          }
          const next = singersRef.current.concat(name);
          singersRef.current = next;
          draftRef.current = "";
          setDraft("");
          onChange(next);
        }}
      />
    </div>
  );
});
