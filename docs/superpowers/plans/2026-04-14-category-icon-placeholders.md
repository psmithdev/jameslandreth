# Category Card Icon Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-based no-photo placeholder in category cards with a category-specific thin-stroke SVG icon (or treble clef unicode for Musical Instruments).

**Architecture:** Single-file change in `src/pages/artifacts/index.astro`. An `iconMap` object (slug → HTML string) is defined once in the Astro frontmatter for SSR rendering, then passed to the client `<script define:vars>` block so `renderColumn` can use the same icons when navigating the slider.

**Tech Stack:** Astro 6 SSR, inline SVG strings, Tailwind CSS v4 (`#C5B89A` = `--color-rule`, `#EDE5D4` = `--color-parchment-dark`).

---

### Task 1: Add `iconMap` to frontmatter and update server-rendered placeholder

**Files:**
- Modify: `src/pages/artifacts/index.astro:44-49` (frontmatter — add iconMap before closing `---`)
- Modify: `src/pages/artifacts/index.astro:125-132` (no-photo placeholder div in template)

- [ ] **Step 1: Add `iconMap` to the Astro frontmatter**

In `src/pages/artifacts/index.astro`, find the closing `---` of the frontmatter (currently around line 49). Insert the following `iconMap` object immediately before that closing `---`:

```ts
const svg = (inner: string) =>
  `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="#C5B89A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const iconMap: Record<string, string> = {
  'books-documents': svg(
    `<rect x="10" y="8" width="20" height="32" rx="1" fill="#EDE5D4"/>` +
    `<rect x="10" y="8" width="20" height="32" rx="1"/>` +
    `<rect x="18" y="8" width="20" height="32" rx="1" fill="#EDE5D4"/>` +
    `<rect x="18" y="8" width="20" height="32" rx="1"/>` +
    `<line x1="22" y1="16" x2="34" y2="16"/>` +
    `<line x1="22" y1="21" x2="34" y2="21"/>` +
    `<line x1="22" y1="26" x2="30" y2="26"/>`
  ),
  'china-porcelain': svg(
    `<ellipse cx="24" cy="34" rx="14" ry="3"/>` +
    `<path d="M12 18 Q12 34 24 34 Q36 34 36 18 Z"/>` +
    `<ellipse cx="24" cy="18" rx="12" ry="3"/>` +
    `<path d="M18 10 Q18 6 24 6 Q30 6 30 10"/>` +
    `<line x1="18" y1="10" x2="30" y2="10"/>`
  ),
  'furniture': svg(
    `<rect x="8" y="18" width="32" height="12" rx="2"/>` +
    `<rect x="12" y="12" width="24" height="8" rx="2"/>` +
    `<line x1="12" y1="30" x2="12" y2="39"/>` +
    `<line x1="36" y1="30" x2="36" y2="39"/>` +
    `<line x1="8" y1="24" x2="8" y2="30"/>` +
    `<line x1="40" y1="24" x2="40" y2="30"/>`
  ),
  'glassware-crystal': svg(
    `<path d="M17 8 L14 22 Q14 32 24 32 Q34 32 34 22 L31 8 Z"/>` +
    `<line x1="24" y1="32" x2="24" y2="40"/>` +
    `<line x1="17" y1="40" x2="31" y2="40"/>` +
    `<line x1="15" y1="20" x2="33" y2="20"/>`
  ),
  'lighting': svg(
    `<path d="M18 28 Q14 22 14 18 A10 10 0 0 1 34 18 Q34 22 30 28 Z"/>` +
    `<line x1="18" y1="28" x2="30" y2="28"/>` +
    `<line x1="19" y1="32" x2="29" y2="32"/>` +
    `<line x1="21" y1="36" x2="27" y2="36"/>` +
    `<line x1="24" y1="8" x2="24" y2="5"/>` +
    `<line x1="10" y1="18" x2="7" y2="18"/>` +
    `<line x1="38" y1="18" x2="41" y2="18"/>` +
    `<line x1="13" y1="11" x2="11" y2="9"/>` +
    `<line x1="35" y1="11" x2="37" y2="9"/>`
  ),
  'linens-textiles':
    `<svg width="48" height="44" viewBox="0 0 54 46" fill="none" stroke="#C5B89A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M8 36 Q8 42 27 42 Q46 42 46 36 L46 32 Q46 28 27 28 Q8 28 8 32 Z"/>` +
    `<rect x="10" y="18" width="13" height="12" rx="3"/>` +
    `<rect x="25" y="18" width="13" height="12" rx="3"/>` +
    `<path d="M8 22 Q8 18 10 18"/>` +
    `<path d="M46 22 Q46 18 44 18"/>` +
    `<line x1="8" y1="22" x2="8" y2="32"/>` +
    `<line x1="46" y1="22" x2="46" y2="32"/>` +
    `<line x1="10" y1="18" x2="25" y2="18"/>` +
    `<line x1="38" y1="18" x2="44" y2="18"/>` +
    `</svg>`,
  'miscellaneous': svg(
    `<path d="M6 18 L6 38 Q6 40 8 40 L40 40 Q42 40 42 38 L42 18 Q42 16 40 16 L26 16 L22 12 L8 12 Q6 12 6 14 L6 18 Z"/>` +
    `<line x1="6" y1="18" x2="42" y2="18"/>`
  ),
  'musical-instruments':
    `<span style="font-size:44px;color:#C5B89A;font-family:serif;line-height:1;">𝄞</span>`,
  'paintings-art': svg(
    `<rect x="8" y="8" width="32" height="26" rx="1"/>` +
    `<path d="M8 26 L17 18 L25 24 L32 16 L40 26"/>` +
    `<circle cx="16" cy="16" r="3"/>` +
    `<line x1="16" y1="36" x2="16" y2="40"/>` +
    `<line x1="32" y1="36" x2="32" y2="40"/>` +
    `<line x1="12" y1="40" x2="36" y2="40"/>`
  ),
};
```

- [ ] **Step 2: Replace the no-photo placeholder in the template**

Find the no-photo fallback `<div>` in the template (currently around line 125-132):

**Before:**
```astro
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

**After:**
```astro
) : (
  <div class="cat-photo w-full h-full flex items-center justify-center">
    <Fragment set:html={iconMap[group.slug] ?? iconMap['miscellaneous']} />
  </div>
)}
```

- [ ] **Step 3: Verify server render in the browser**

Navigate to `http://localhost:4324/artifacts`. Scroll to the "Browse by Category" section.

Expected:
- Each photo-less category card shows its SVG icon centered on the parchment background
- Musical Instruments shows the `𝄞` treble clef glyph
- No "No Photo" text anywhere
- No brown top border on the placeholder

- [ ] **Step 4: Commit**

```bash
git add src/pages/artifacts/index.astro
git commit -m "Add: category icon map and server-rendered icon placeholders"
```

---

### Task 2: Pass `iconMap` via `define:vars` and update `renderColumn`

**Files:**
- Modify: `src/pages/artifacts/index.astro` — `<script define:vars>` tag and `renderColumn` no-photo branch

- [ ] **Step 1: Add `iconMap` to `define:vars`**

Find the `<script define:vars>` opening tag (currently `<script define:vars={{ categoryGroups }}>`).

**Before:**
```astro
<script define:vars={{ categoryGroups }}>
```

**After:**
```astro
<script define:vars={{ categoryGroups, iconMap }}>
```

This makes `iconMap` available as a variable inside the script block, JSON-serialized by Astro.

- [ ] **Step 2: Update `renderColumn` no-photo branch**

Find the `else` block inside `renderColumn` (currently around lines 351-362):

**Before:**
```js
} else {
  if (photoEl.tagName === 'IMG') {
    const div = document.createElement('div');
    div.className = 'cat-photo w-full h-full flex items-center justify-center';
    div.style.borderTop = '4px solid var(--color-stamp-art)';
    const span = document.createElement('span');
    span.className = 'font-mono text-[13px] tracking-[0.2em] uppercase text-ink-muted text-center px-4 leading-relaxed';
    span.textContent = group.name;
    div.appendChild(span);
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
    div.innerHTML = iconMap[group.slug] ?? iconMap['miscellaneous'];
    photoEl.replaceWith(div);
  }
}
```

Note: `iconMap` is safe to use with `innerHTML` here because the values are hardcoded SVG strings defined entirely in our source code — not user-supplied data.

- [ ] **Step 3: Also update the `define:vars` comment to reflect `iconMap`**

Find the comment just above `const indices`:

**Before:**
```js
// categoryGroups is injected by define:vars — shape:
// Array<{ name: string; slug: string; startIdx: number; items: Array<{ title, status, images, slug }> }>
```

**After:**
```js
// Injected by define:vars:
// categoryGroups: Array<{ name: string; slug: string; startIdx: number; items: Array<{ title, status, images, slug }> }>
// iconMap: Record<string, string> — slug → SVG/HTML string for no-photo placeholder
```

- [ ] **Step 4: Verify slider navigation in the browser**

Navigate to `http://localhost:4324/artifacts`. For a photo-less category (e.g. Books & Documents):
1. Click `›` next — counter increments, title/status update, icon stays visible
2. Click `‹` prev — counter decrements correctly
3. If navigating from a photo item back to a no-photo item, icon re-appears (not the old text placeholder)

- [ ] **Step 5: Commit**

```bash
git add src/pages/artifacts/index.astro
git commit -m "Add: pass iconMap to client script, update renderColumn placeholder"
```
