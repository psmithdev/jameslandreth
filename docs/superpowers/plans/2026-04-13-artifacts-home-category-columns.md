# Artifacts Home — Category Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Browse by Category" section to the artifacts home page — 4 side-by-side columns, each with a photo slider and a "VIEW ALL" link to a new dedicated category page.

**Architecture:** New HTML section injected into `artifacts/index.astro` between the hero and the existing grid. Client-side JS manages slider state per column (no new deps). A new dynamic route `artifacts/category/[slug].astro` handles the category detail page.

**Tech Stack:** Astro 6 SSR, Tailwind CSS v4, Supabase (service role client), TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/pages/artifacts/index.astro` | Add Browse by Category section + slider JS |
| Create | `src/pages/artifacts/category/[slug].astro` | Category detail page |

---

## Task 1: Add Browse by Category section to the home page

**Files:**
- Modify: `src/pages/artifacts/index.astro`

No new dependencies. All data comes from the existing `items` array already fetched on this page.

### How the grouping works (server-side, in the frontmatter)

```typescript
// slug helper — category name → URL slug
function categorySlug(cat: string) {
  return cat.toLowerCase().replace(/\s+/g, '-');
}

// Group items by category, sorted alphabetically, excluding empty categories
const categoryMap = new Map<string, typeof items>();
for (const item of items) {
  if (!categoryMap.has(item.category)) categoryMap.set(item.category, []);
  categoryMap.get(item.category)!.push(item);
}
const categoryGroups = [...categoryMap.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, catItems]) => ({ name, slug: categorySlug(name), items: catItems }));
```

### How the slider works (client-side JS)

Each column has a `data-cat` attribute. Arrow buttons call `slide(cat, direction)` which increments/decrements an index stored in a `Map`. On change, the column's `<img>`, title, and status badge update in place.

### Steps

- [ ] **Step 1: Add frontmatter helpers**

Open `src/pages/artifacts/index.astro`. In the frontmatter block (between the `---` fences), add after the existing `const categories = ...` line:

```typescript
function categorySlug(cat: string) {
  return cat.toLowerCase().replace(/\s+/g, '-');
}

const categoryGroups = (() => {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, catItems]) => ({ name, slug: categorySlug(name), items: catItems }));
})();
```

- [ ] **Step 2: Add the Browse by Category HTML section**

In `src/pages/artifacts/index.astro`, locate the comment `<!-- Search & Filters -->` inside `<div class="max-w-6xl mx-auto px-6 py-10">`. Insert the following block **immediately before** that comment:

```astro
<!-- Browse by Category -->
<section class="mb-10">
  <div class="flex items-center gap-4 mb-6">
    <span class="font-mono text-[13px] tracking-[0.2em] uppercase text-ink-muted">Browse by Category</span>
    <div class="flex-1 h-px bg-rule"></div>
  </div>

  <div
    class="flex gap-4 overflow-x-auto pb-2"
    style="scroll-snap-type: x mandatory;"
    id="category-columns"
  >
    {categoryGroups.map(group => (
      <div
        class="flex-none w-[calc(25%-12px)] min-w-[200px] border border-rule flex flex-col"
        style="scroll-snap-align: start;"
        data-cat={group.slug}
      >
        <!-- Header -->
        <div class="bg-stamp-art px-4 py-2 flex items-center justify-between">
          <span class="font-mono text-[12px] tracking-[0.15em] uppercase text-card">
            {group.name}
          </span>
          <span class="font-mono text-[11px] text-card/70">{group.items.length}</span>
        </div>

        <!-- Slider body -->
        <div class="flex-1 flex flex-col p-4 gap-3 bg-card">
          <!-- Photo -->
          <div class="relative aspect-[4/3] bg-parchment-dark border border-rule overflow-hidden">
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

            <!-- Arrows -->
            <button
              class="cat-prev absolute left-0 inset-y-0 w-8 flex items-center justify-center bg-ink/10 hover:bg-ink/20 transition-colors text-card font-bold text-lg disabled:opacity-20"
              data-cat={group.slug}
              aria-label="Previous item"
            >
              ‹
            </button>
            <button
              class="cat-next absolute right-0 inset-y-0 w-8 flex items-center justify-center bg-ink/10 hover:bg-ink/20 transition-colors text-card font-bold text-lg disabled:opacity-20"
              data-cat={group.slug}
              aria-label="Next item"
            >
              ›
            </button>
          </div>

          <!-- Item info -->
          <div>
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
          </div>

          <!-- Counter -->
          <p class="cat-counter font-mono text-[11px] tracking-[0.1em] text-rule">
            1 / {group.items.length}
          </p>
        </div>

        <!-- View All footer -->
        <a
          href={`/artifacts/category/${group.slug}`}
          class="block text-center font-mono text-[12px] tracking-[0.15em] uppercase text-stamp-art hover:text-card hover:bg-stamp-art transition-colors py-2.5 border-t border-rule bg-card"
        >
          View All →
        </a>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 3: Replace the script block with one that includes the slider**

The slider needs access to server-side item data (images, titles, statuses) at runtime. Astro's `define:vars` passes server values into a client `<script>` as JSON. Replace the entire existing `<script>` block at the bottom of `src/pages/artifacts/index.astro` with the block below. It contains both the existing filter logic (unchanged) and the new slider logic.

**Full replacement for the `<script>` block:**

```astro
<script define:vars={{ categoryGroups }}>
  // ── Existing filter logic ────────────────────────────────────────
  const searchInput = document.getElementById('artifact-search');
  const familySelect = document.getElementById('filter-family');
  const grid = document.getElementById('items-grid');
  const noResults = document.getElementById('no-results');
  let activeCategory = 'All Items';

  function applyFilters() {
    const search = searchInput.value.toLowerCase().trim();
    const family = familySelect.value;
    const items = grid.querySelectorAll('.artifact-item');
    let count = 0;

    items.forEach(item => {
      const matchSearch = !search ||
        item.dataset.title.includes(search) ||
        item.dataset.description.includes(search);
      const matchCategory = activeCategory === 'All Items' || item.dataset.category === activeCategory;
      const matchFamily = !family || item.dataset.family === family;

      const visible = matchSearch && matchCategory && matchFamily;
      item.style.display = visible ? '' : 'none';
      if (visible) count++;
    });

    noResults.classList.toggle('hidden', count > 0);
  }

  searchInput.addEventListener('input', () => setTimeout(applyFilters, 100));
  familySelect.addEventListener('change', applyFilters);

  document.querySelectorAll('.cat-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tag').forEach(b => {
        b.classList.remove('bg-stamp-art', 'text-card', 'border-stamp-art');
        b.classList.add('bg-card', 'text-ink-muted', 'border-rule');
      });
      btn.classList.remove('bg-card', 'text-ink-muted', 'border-rule');
      btn.classList.add('bg-stamp-art', 'text-card', 'border-stamp-art');
      activeCategory = btn.dataset.category;
      applyFilters();
    });
  });

  document.getElementById('clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    familySelect.value = '';
    activeCategory = 'All Items';
    document.querySelectorAll('.cat-tag').forEach(b => {
      b.classList.remove('bg-stamp-art', 'text-card', 'border-stamp-art');
      b.classList.add('bg-card', 'text-ink-muted', 'border-rule');
    });
    const allBtn = document.querySelector('.cat-tag[data-category="All Items"]');
    if (allBtn) {
      allBtn.classList.remove('bg-card', 'text-ink-muted', 'border-rule');
      allBtn.classList.add('bg-stamp-art', 'text-card', 'border-stamp-art');
    }
    applyFilters();
  });

  // ── Category column sliders ──────────────────────────────────────
  // categoryGroups is injected by define:vars — shape:
  // Array<{ name: string; slug: string; items: Array<{ title, status, images, slug }> }>

  const indices = {}; // slug → current index
  categoryGroups.forEach(g => { indices[g.slug] = 0; });

  function renderColumn(slug) {
    const group = categoryGroups.find(g => g.slug === slug);
    if (!group) return;
    const idx = indices[slug];
    const item = group.items[idx];
    const col = document.querySelector(`[data-cat="${slug}"].flex-none`);
    if (!col) return;

    // Photo
    const photoEl = col.querySelector('.cat-photo');
    if (item.images && item.images.length > 0) {
      if (photoEl.tagName === 'IMG') {
        photoEl.src = item.images[0];
        photoEl.alt = item.title;
      } else {
        // replace div with img
        const img = document.createElement('img');
        img.className = 'cat-photo w-full h-full object-cover';
        img.src = item.images[0];
        img.alt = item.title;
        photoEl.replaceWith(img);
      }
    } else {
      if (photoEl.tagName === 'IMG') {
        const div = document.createElement('div');
        div.className = 'cat-photo w-full h-full flex items-center justify-center';
        div.innerHTML = '<span class="font-mono text-[11px] tracking-[0.1em] uppercase text-rule">No Photo</span>';
        photoEl.replaceWith(div);
      }
    }

    // Title
    col.querySelector('.cat-title').textContent = item.title;

    // Status
    const statusEl = col.querySelector('.cat-status');
    statusEl.textContent = item.status;
    const isAvail = item.status === 'available';
    statusEl.className = `cat-status font-mono text-[11px] tracking-[0.1em] uppercase px-2 py-0.5 border ${
      isAvail ? 'border-available text-available' : 'border-rule text-rule'
    }`;

    // Counter
    col.querySelector('.cat-counter').textContent = `${idx + 1} / ${group.items.length}`;
  }

  document.querySelectorAll('.cat-prev').forEach(btn => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.cat;
      const group = categoryGroups.find(g => g.slug === slug);
      if (!group) return;
      indices[slug] = (indices[slug] - 1 + group.items.length) % group.items.length;
      renderColumn(slug);
    });
  });

  document.querySelectorAll('.cat-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.cat;
      const group = categoryGroups.find(g => g.slug === slug);
      if (!group) return;
      indices[slug] = (indices[slug] + 1) % group.items.length;
      renderColumn(slug);
    });
  });
</script>
```

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:4321` in a browser. The `Host` header won't match `artifacts.*` in local dev, so open `http://localhost:4321/artifacts` directly.

Check:
1. "Browse by Category" section appears between the hero stats and the search bar
2. 4 columns are visible side-by-side on a wide window; fewer on a narrow window with horizontal scroll
3. `‹` and `›` arrows cycle through items — photo, title, and status all update
4. Counter shows `2 / 6` etc. after clicking
5. "VIEW ALL →" link href is `/artifacts/category/<slug>` (hover to confirm in the status bar)

- [ ] **Step 5: Commit**

```bash
git add src/pages/artifacts/index.astro
git commit -m "Add Browse by Category section to artifacts home"
```

---

## Task 2: Create the category detail page

**Files:**
- Create: `src/pages/artifacts/category/[slug].astro`

### How slug-to-category matching works

The slug is derived from the category name: `cat.toLowerCase().replace(/\s+/g, '-')`. To reverse it at query time, fetch all artifacts and filter where the derived slug matches `Astro.params.slug`. This avoids storing slugs in the DB.

### Steps

- [ ] **Step 1: Create the directory and file**

Create `src/pages/artifacts/category/[slug].astro` with this content:

```astro
---
import ArtifactsLayout from '../../../layouts/ArtifactsLayout.astro';
import ArtifactCard from '../../../components/artifacts/ArtifactCard.astro';
import { createServerClient } from '../../../lib/supabase';

const { slug } = Astro.params;
const supabase = createServerClient();

const { data: allArtifacts } = await supabase
  .from('artifacts')
  .select('*')
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

const items = (allArtifacts || []).filter(
  item => item.category.toLowerCase().replace(/\s+/g, '-') === slug
);

// Reconstruct display name from first match (preserves original casing)
const categoryName = items[0]?.category ?? slug;

if (items.length === 0) {
  return Astro.redirect('/');
}
---

<ArtifactsLayout title={`${categoryName} — Family Treasures`}>

  <div class="max-w-6xl mx-auto px-6 py-10">

    <!-- Back link -->
    <a
      href="/"
      class="inline-flex items-center gap-2 font-mono text-[13px] tracking-[0.12em] uppercase text-stamp-art hover:text-stamp-art-hover transition-colors mb-8"
    >
      ← All Categories
    </a>

    <!-- Header -->
    <div class="border-b border-rule pb-6 mb-8">
      <p class="font-mono text-[13px] tracking-[0.2em] uppercase text-stamp-art mb-2">Category</p>
      <h2 class="font-display text-4xl text-ink leading-tight mb-1">{categoryName}</h2>
      <p class="font-mono text-[13px] tracking-[0.15em] uppercase text-rule">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => (
        <ArtifactCard
          slug={item.slug}
          title={item.title}
          category={item.category}
          family={item.family}
          description={item.description}
          provenance={item.provenance}
          estimatedValue={item.estimated_value}
          status={item.status}
          images={item.images}
        />
      ))}
    </div>

  </div>

</ArtifactsLayout>
```

- [ ] **Step 2: Verify in dev server**

With `npm run dev` still running, navigate to `http://localhost:4321/artifacts/category/<any-slug>` where `<any-slug>` is one of the slugs you saw linked from the "VIEW ALL →" buttons in Task 1.

Check:
1. Page loads without errors
2. Header shows the original category name (e.g. `Lanterns`, not `lanterns`)
3. Item count is correct
4. Grid shows the same items from that category
5. Each `ArtifactCard` links correctly to its item page
6. "← All Categories" link returns to `/`
7. Navigate to a slug that doesn't exist (e.g. `/artifacts/category/foobar`) — should redirect to `/`

- [ ] **Step 3: Commit**

```bash
git add src/pages/artifacts/category/[slug].astro
git commit -m "Add category detail page at /artifacts/category/[slug]"
```

---

## Task 3: Smoke-test the full flow end to end

- [ ] **Step 1: Full flow check**

With dev server running:

1. Open `http://localhost:4321/artifacts`
2. Pick any category column — click `›` a few times to page through items
3. Click "VIEW ALL →" — confirm you land on the category detail page for that category
4. On the category page, click one `ArtifactCard` — confirm it opens the item detail page
5. On the item detail page, click "Back to Gallery" — confirm it returns to `/`
6. Return to the home page. Confirm the search/filter/grid below the category columns still works (type a search term, switch category tags)

- [ ] **Step 2: Mobile check**

Resize browser to ~375px wide (or use DevTools device emulation).

Check:
1. Category columns section shows one column at a time with horizontal scroll
2. Arrows still work
3. "VIEW ALL →" is visible and tappable

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build completes with no TypeScript errors and no Astro build errors. Warnings about `define:vars` serialization are OK if they don't fail the build.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -p
git commit -m "Fix: <describe what you fixed>"
```

If no fixes needed, skip this step.
