# Category Card Photo Placeholder

**Date:** 2026-04-14
**Status:** Approved
**Scope:** `src/pages/artifacts/index.astro` only

## Problem

The "Browse by Category" columns always use `items[0]` as the representative photo. Many categories have items without photos, and some categories have *zero* items with photos. The current fallback is a plain "No Photo" text label on a blank parchment background, which looks broken rather than intentional.

## Solution

Three targeted changes inside `src/pages/artifacts/index.astro`:

### 1. Server-side representative item selection

Change the server-side initial render to scan for the first item with a photo rather than always using `items[0]`.

```ts
const representativeItem = group.items.find(i => i.images?.[0]) ?? group.items[0];
```

Use `representativeItem` for the initial photo, title, status badge, and counter. If `representativeItem` is not `items[0]`, the counter starts at `representativeIdx + 1 / N`. This keeps the card internally consistent — photo, title, and status all describe the same item.

If no item in the group has a photo, `representativeItem` falls back to `items[0]` and the counter starts at `1 / N` as before.

### 2. Typographic placeholder (no-photo fallback)

Replace the plain "No Photo" span with a styled div:

- **Background:** `bg-parchment-dark` (existing token)
- **Top border:** `4px solid` in `stamp-art` color; left/right/bottom remain `border-rule`
- **Text:** category name, `font-mono tracking-[0.2em] uppercase text-[13px] text-ink-muted`, centered vertically and horizontally
- No icons, no extra decorations — reads as a deliberate archival label

This applies to both:
- The server-rendered Astro template (static HTML on load)
- The client-side `renderColumn()` JS function (prev/next navigation)

### 3. Client-side `renderColumn` parity

Update the no-photo branch in `renderColumn()` to inject the same styled div (with stamp-art top border and category name text) instead of the plain "No Photo" span. The `group.name` value is already available in scope via `define:vars`. No change to the slider index logic itself.

## Constraints

- One file only: `src/pages/artifacts/index.astro`
- No new components, no new CSS files
- Uses only existing Tailwind tokens (`bg-parchment-dark`, `border-stamp-art`, `text-ink-muted`, `font-mono`, etc.)
- The slider index logic is unchanged — counter always starts at `1 / N`
