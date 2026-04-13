# Artifacts Home — Category Columns Redesign

**Date:** 2026-04-13
**Status:** Approved

## Overview

Add a "Browse by Category" section to the artifacts home page (`artifacts.jameslandreth.com`). The section sits between the existing hero and the existing full-collection grid. It presents all artifact categories as side-by-side columns — like a newspaper — each with a photo slider so visitors can scan items quickly before deciding to dive into a category.

## What Changes

### artifacts/index.astro

A new **Browse by Category** section is inserted between the hero stats and the existing search/filter/grid section. Nothing in the hero or grid is removed or modified.

The new section renders 4 columns at a time on desktop, with horizontal scrolling to reach additional categories. Each column contains:

- **Header bar** — category name (uppercase, monospace) + item count (e.g. `LANTERNS · 6`)
- **Photo slider** — displays one item at a time; `‹` and `›` arrow buttons cycle through all items in that category. The photo is the first entry in `item.images` (the same array used by `ArtifactCard`). Below the photo: item title and availability status (`available` / `claimed` / `gifted`).
- **"VIEW ALL →" footer** — links to the dedicated category page (`/artifacts/category/[slug]`)

The photo slider is client-side JavaScript only (no new dependencies). State is local: current index per column, updated on arrow click.

Categories are derived from the existing Supabase query already on the page (`items` array). They are sorted alphabetically. Categories with zero items are excluded.

### New page: artifacts/category/[slug].astro

Dynamic route. The `slug` is the category name lowercased with spaces replaced by hyphens (e.g. `Hand Bells` → `hand-bells`).

Page layout:
- Back link: `← All Categories` → `/` (artifacts home)
- Header: category name (display font, large) + item count
- Full grid of items in that category using the existing `ArtifactCard` component
- Uses `ArtifactsLayout` — same shell as the home page

Data: a single Supabase query filtering `artifacts` by `category` (case-insensitive match, reconstructed from slug).

## Data Flow

No schema changes. The existing Supabase query on `artifacts/index.astro` already returns all items. The category columns section groups them client-side by `item.category`.

The category page makes its own server-side Supabase query filtered by category at render time.

## Slug Convention

`/artifacts/category/[slug]` where slug = `category.toLowerCase().replace(/\s+/g, '-')`.

The category page reverses this by fetching all artifacts (SSR, small dataset) and filtering server-side: `item.category.toLowerCase().replace(/\s+/g, '-') === params.slug`. This avoids storing slugs in the database and handles categories with spaces or mixed case without additional schema work.

## Mobile Behavior

On mobile (< `md` breakpoint), the category columns section collapses to a single-column horizontal scroll strip — one column visible at a time, swipeable. The "VIEW ALL →" link remains accessible below each slider.

## What Is Not Changing

- Hero section (stats, tagline, family names)
- Search bar, category filter tags, family dropdown
- Full-collection item grid
- `ArtifactCard` component
- Individual item pages (`/artifacts/items/[slug]`)
- Admin pages
- Database schema
