# Category Card Photo Placeholder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare "No Photo" label in category cards with a typographic placeholder, and initialize each card's slider at the first item that actually has a photo.

**Architecture:** Single-file change in `src/pages/artifacts/index.astro`. The `categoryGroups` computation gains a `startIdx` field (index of first photo-bearing item, or 0). The server-rendered template and the client-side `renderColumn` JS both use this value for initial display and for the styled no-photo fallback.

**Tech Stack:** Astro 6 SSR, Tailwind CSS v4 (CSS variable tokens in `src/styles/global.css`), vanilla JS in `<script define:vars>`.

---

### Task 1: Add `startIdx` to `categoryGroups` and update server-rendered template

**Files:**
- Modify: `src/pages/artifacts/index.astro:26-38` (categoryGroups computation)
- Modify: `src/pages/artifacts/index.astro:113-159` (photo slot, title, status, counter in template)

- [ ] **Step 1: Add `startIdx` to the `categoryGroups` map**

In `src/pages/artifacts/index.astro`, find the `categoryGroups` `.map()` call (currently ends around line 38). Replace the `.map()` body:

**Before:**
```ts
.map(([name, catItems]) => ({
  name,
  slug: categorySlug(name),
  items: catItems.map(({ title, status, images, slug }) => ({ title, status, images, slug })),
}));
```

**After:**
```ts
.map(([name, catItems]) => {
  const startIdx = Math.max(0, catItems.findIndex(i => i.images?.[0]));
  return {
    name,
    slug: categorySlug(name),
    items: catItems.map(({ title, status, images, slug }) => ({ title, status, images, slug })),
    startIdx,
  };
});
```

`findIndex` returns `-1` when no item has a photo; `Math.max(0, -1)` clamps that to `0`.

- [ ] **Step 2: Update the photo slot to use `group.items[group.startIdx]`**

Find the photo slot in the template (the `<div class="relative aspect-[4/3]...">` block). Replace the two occurrences of `group.items[0]` inside it:

**Before:**
```astro
{group.items[0]?.images?.[0] ? (
  <img
    class="cat-photo w-full h-full object-cover"
    src={group.items[0].images[0]}
    alt={group.items[0].title}
  />
) : (
  <div class="cat-photo w-full h-full flex items-center justify-center">
    <span class="font-mono text-[11px] tracking-[0.1em] uppercase text-rule">No Photo</span>
  </div>
)}
```

**After:**
```astro
{group.items[group.startIdx]?.images?.[0] ? (
  <img
    class="cat-photo w-full h-full object-cover"
    src={group.items[group.startIdx].images[0]}
    alt={group.items[group.startIdx].title}
  />
) : (
  <div
    class="cat-photo w-full h-full flex items-center justify-center"
    style="border-top: 4px solid var(--color-stamp-art);"
  >
    <span class="font-mono text-[13px] tracking-[0.2em] uppercase text-ink-muted text-center px-4 leading-relaxed">
      {group.name}
    </span>
  </div>
)}
```

- [ ] **Step 3: Update item info block to use `group.items[group.startIdx]`**

Find the `<!-- Item info -->` block. Replace all three `group.items[0]` references:

**Before:**
```astro
<p class="cat-title font-display text-base text-ink leading-snug mb-1 line-clamp-2">
  {group.items[0]?.title ?? ''}
</p>
<span class={`cat-status font-mono text-[11px] tracking-[0.1em] uppercase px-2 py-0.5 border ${
  group.items[0]?.status === 'available'
    ? 'border-available text-available'
    : 'border-rule text-rule'
}`}>
  {group.items[0]?.status ?? ''}
</span>
```

**After:**
```astro
<p class="cat-title font-display text-base text-ink leading-snug mb-1 line-clamp-2">
  {group.items[group.startIdx]?.title ?? ''}
</p>
<span class={`cat-status font-mono text-[11px] tracking-[0.1em] uppercase px-2 py-0.5 border ${
  group.items[group.startIdx]?.status === 'available'
    ? 'border-available text-available'
    : 'border-rule text-rule'
}`}>
  {group.items[group.startIdx]?.status ?? ''}
</span>
```

- [ ] **Step 4: Update counter to use `group.startIdx`**

Find the `<!-- Counter -->` paragraph:

**Before:**
```astro
<p class="cat-counter font-mono text-[11px] tracking-[0.1em] text-rule">
  1 / {group.items.length}
</p>
```

**After:**
```astro
<p class="cat-counter font-mono text-[11px] tracking-[0.1em] text-rule">
  {group.startIdx + 1} / {group.items.length}
</p>
```

- [ ] **Step 5: Check the page in the browser**

Navigate to `http://localhost:4321/artifacts` (or whichever port the dev server is on).

Expected:
- Category cards that have at least one photo now show a photo on load, with matching title/status/counter
- Category cards with zero photos show the category name in brown mono caps, with a `#7B4F1A` top border — not blank parchment with "No Photo"

- [ ] **Step 6: Commit**

```bash
git add src/pages/artifacts/index.astro
git commit -m "Fix: use first photo item as category card representative"
```

---

### Task 2: Update client-side JS to match

**Files:**
- Modify: `src/pages/artifacts/index.astro` — `<script define:vars>` block (indices init + `renderColumn` no-photo branch)

- [ ] **Step 1: Initialize `indices` from `startIdx`**

Find this line in the `<script define:vars>` block:

```js
categoryGroups.forEach(g => { indices[g.slug] = 0; });
```

Replace with:

```js
categoryGroups.forEach(g => { indices[g.slug] = g.startIdx ?? 0; });
```

This ensures that pressing prev/next starts from the same item shown on server render.

- [ ] **Step 2: Update the no-photo branch in `renderColumn`**

Find the `else` branch inside `renderColumn` that handles `photoEl.tagName === 'IMG'` (the branch that replaces an `<img>` with a "No Photo" div):

**Before:**
```js
} else {
  if (photoEl.tagName === 'IMG') {
    const div = document.createElement('div');
    div.className = 'cat-photo w-full h-full flex items-center justify-center';
    div.innerHTML = '<span class="font-mono text-[11px] tracking-[0.1em] uppercase text-rule">No Photo</span>';
    photoEl.replaceWith(div);
  }
}
```

**After:**
```js
} else {
  if (photoEl.tagName === 'IMG') {
    const div = document.createElement('div');
    div.className = 'cat-photo w-full h-full flex items-center justify-center';
    div.style.borderTop = '4px solid var(--color-stamp-art)';
    div.innerHTML = `<span class="font-mono text-[13px] tracking-[0.2em] uppercase text-ink-muted text-center px-4 leading-relaxed">${group.name}</span>`;
    photoEl.replaceWith(div);
  }
}
```

Note: `group.name` is the display name (e.g. `"Books & Documents"`), available in `renderColumn`'s scope because `group` is the local variable from `categoryGroups.find(...)` at the top of the function.

- [ ] **Step 3: Verify slider navigation in the browser**

Navigate to `http://localhost:4321/artifacts` (or current dev port).

For a category with photos: click next/prev — counter increments/decrements, photo/title/status update.

For a category with zero photos: click next/prev — the typographic placeholder (category name, brown top border) stays; title/status/counter update correctly.

- [ ] **Step 4: Commit**

```bash
git add src/pages/artifacts/index.astro
git commit -m "Fix: styled typographic placeholder for photo-less category cards"
```
