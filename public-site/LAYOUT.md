# LAYOUT.md — Public site (`www.huhansen.cn`)

> Layout and typography constraints for `public-site/`. **Do not change horizontal gutters when tuning hero spacing.**

Source: `public-site/` → OSS `huhansen-www` → CDN `www.huhansen.cn` (Shanghai stack).

---

## Scope

These rules apply to the **hero banner** (头图) and its relationship to the first **PROFILE** panel on **narrow viewports** (phone portrait, phone landscape, tablet portrait).

---

## Hard constraints

| Rule | Detail |
|---|---|
| **Vertical only** | Hero spacing changes adjust **top/bottom** padding and hero→PROFILE gap only. |
| **Do not touch horizontal layout** | Do not remove `main-content` side padding, full-bleed panels, `--page-inset` / `--page-gutter`, or panel border-left/right on mobile. |
| **No overflow** | `document.documentElement.scrollWidth` must equal viewport width at 360–414px. |
| **Subtitle = meta size** | `.hero-subtitle` and `.hero-meta` use the same `font-size` (`var(--text-lg)`). Never shrink subtitle alone. |
| **Subtitle single line** | On phone, subtitle stays **one line** (`white-space: nowrap`). |
| **No forced wrap** | Do not use `text-wrap: balance` on subtitle — it breaks one line even when width fits. |
| **No visual indent** | Do not prefix subtitle with `>` / typed-cursor; do not use multi-line HTML that inserts leading whitespace. |
| **Left alignment** | Subtitle first character aligns with `LOC:` on the meta row (same left edge). |

---

## Vertical spacing model

Use **two separate variables** — do not collapse into one symmetric padding:

| Variable | Meaning |
|---|---|
| `--hero-padding-top` | Space inside hero: nav bottom → first line (`// ENGINEERING NODE`) |
| `--hero-padding-bottom` | Space inside hero: last line (meta) → hero bottom border |
| `--hero-profile-gap` | Space **outside** hero: hero bottom border → PROFILE panel top |

**Top and bottom padding inside hero must both be increased together.** Adding only `--hero-padding-top` while leaving `--hero-padding-bottom` small looks top-heavy.

### Phone portrait (`max-width: 600px`)

```css
--hero-padding-top: 3.5rem;      /* 56px — includes +32px breathing room vs compact baseline */
--hero-padding-bottom: 3.5rem; /* must match top */
--hero-profile-gap: 1.75rem;   /* gap after hero border, before PROFILE box */
```

### Phone landscape (`orientation: landscape`, `max-width: 960px`, `max-height: 500px`)

```css
--hero-padding-top: 3.15rem;
--hero-padding-bottom: 3.15rem;
--hero-profile-gap: 1.65rem;
```

### Tablet portrait (`601px–960px`, portrait)

Uses `--hero-edge-gap` (symmetric top/bottom inside hero) + `--hero-profile-gap: 1.5rem`. Do not apply the phone +32px values here unless explicitly requested.

---

## Typography (hero block)

| Element | Rule |
|---|---|
| `.hero-subtitle` | `font-size: var(--text-lg)`; shared letter-spacing with `.hero-meta` |
| `.hero-meta` | Same size and letter-spacing as subtitle on the same breakpoint |
| Mobile letter-spacing | `@media (max-width: 600px)` — both use `letter-spacing: normal` (override the `0.08em` from `@media (max-width: 960px)`) so Goldman Sachs fits on one line without shrinking font |
| `.hero-name-zh` | Mobile: `letter-spacing: 0.12em` (not `0.35em` — too wide on small screens) |
| Per-width font shrink | **Forbidden** — do not set a smaller `font-size` on subtitle or meta at `max-width: 360px` alone |

### HTML

```html
<!-- Correct: one line, no prompt, no indent -->
<p class="hero-subtitle">Executive Director · Engineering · Goldman Sachs</p>

<!-- Wrong: > prefix and line breaks create misaligned indent -->
<p class="hero-subtitle">
  <span class="typed-cursor">&gt;</span>
  Executive Director · ...
</p>
```

---

## Horizontal layout (leave unchanged)

On mobile, keep existing gutters from `main`:

- `.main-content`: `padding: 0 clamp(1rem, 4vw, 2rem) 3rem`
- `.hero-content`: `padding: 0 0.75rem` (portrait) — horizontal only
- `.panel-body`: default `padding: 1.25rem 1.5rem 1.5rem`
- Panels keep left/right borders

**Rejected approaches (do not re-introduce):** full-bleed panels, `--page-inset`, zeroing `main-content` horizontal padding, removing panel side borders.

---

## Verification checklist

Before marking hero layout work done:

- [ ] Screenshot **390×844** portrait and **844×390** landscape; visually review spacing yourself
- [ ] `nav → tag` ≈ `--hero-padding-top`
- [ ] `meta → hero bottom` ≈ `--hero-padding-bottom`
- [ ] `hero border → PROFILE` = `--hero-profile-gap`
- [ ] Subtitle one line; `font-size` equals meta line
- [ ] Subtitle left edge aligns with `LOC:`
- [ ] No horizontal scroll at 360px, 390px, 414px
- [ ] No horizontal gutter / panel width changes in the diff unless explicitly requested

---

## Common mistakes

1. Treating “wider spacing” as **horizontal** content width — user meant **vertical** hero margins.
2. Using `text-wrap: balance` or smaller subtitle font to fix overflow — breaks size parity and forces two lines.
3. Increasing only `--hero-padding-top` — bottom stays cramped.
4. Merging hero bottom padding and PROFILE `margin-top` into one variable without keeping both visually adequate.
5. Shipping layout changes without screenshot self-review.
