# Category Card Icon Placeholders

**Date:** 2026-04-14
**Status:** Approved
**Scope:** `src/pages/artifacts/index.astro` only

## Problem

The current no-photo placeholder shows the category name twice — once in the card header and once as text in the photo slot. This looks redundant.

## Solution

Replace the text-based placeholder with a category-specific icon in the photo slot. Categories with actual photos are unaffected.

## Icon Map

| Category slug | Icon approach | Notes |
|---|---|---|
| `books-documents` | Thin-stroke SVG: two stacked/overlapping books | |
| `china-porcelain` | Thin-stroke SVG: urn/vase with lid | |
| `furniture` | Thin-stroke SVG: sofa with backrest | |
| `glassware-crystal` | Thin-stroke SVG: wine/goblet glass | |
| `lighting` | Thin-stroke SVG: lightbulb with rays | |
| `linens-textiles` | Thin-stroke SVG: bed with two pillows | |
| `miscellaneous` | Thin-stroke SVG: open folder | |
| `musical-instruments` | Unicode glyph `𝄞` (U+1D11E) in serif font, `text-[44px]`, `color: #C5B89A` | |
| `paintings-art` | Thin-stroke SVG: framed landscape on easel | |
| *(fallback)* | Thin-stroke SVG: open folder (same as miscellaneous) | For any future unknown categories |

## Visual Style

- All SVG icons: `stroke="#C5B89A"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, `width/height="44"`, `viewBox="0 0 48 48"`
- Unicode treble clef: `font-family: serif`, `font-size: 44px`, `color: #C5B89A`
- Placeholder div: `bg-parchment-dark`, no border-top accent (remove the `border-top: 4px solid var(--color-stamp-art)` from the previous iteration)
- Icon is centered horizontally and vertically in the 4:3 photo slot

## Implementation

All changes in `src/pages/artifacts/index.astro`:

1. **Icon lookup helper** — a plain object mapping category slug → SVG/HTML string, defined in the frontmatter `<script>` block (server-side, used for SSR template rendering). A separate copy is needed for the client-side `define:vars` script.

2. **Server-rendered placeholder** — replace the current fallback `<div>` with one that renders `innerHTML` from the icon map keyed on `group.slug`.

3. **Client-side `renderColumn` placeholder** — same icon map object defined inside the `<script define:vars>` block (or passed through `define:vars`), used when `renderColumn` encounters an item with no photo.

## Constraints

- One file only: `src/pages/artifacts/index.astro`
- No new files, no icon library dependency
- SVG strings are inlined — no external assets
- `startIdx` logic from the previous implementation is unchanged
