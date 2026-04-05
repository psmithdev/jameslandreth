# Ingest New Photo Batch

## Before you start

- Photos go in: `tmp/artifact-photos/`
- Supported formats: JPG, HEIC, PNG
- If you have a notes doc (like the lamp collection doc), drop it in the same
  folder

## Steps

### 1. Clear previous state

rm tmp/ingest-state.json

### 2. Drop photos in

Copy or move new photos into `tmp/artifact-photos/`

### 3. Run ingest

cd /home/parker/the_odin_project/jameslandreth
npm run ingest

### 4. Watch the terminal

- **Classify pass** — matches photos to existing artifacts
- **Propose pass** — groups unmatched photos into new artifact cards
- Browser opens automatically at `http://localhost:3848`

### 5. Review in browser

**Matched Photos** (top section)

- Photos Claude matched to existing artifacts
- Check the confidence badge — reassign from dropdown if wrong
- Uncheck to exclude a photo

**New Artifacts** (bottom section)

- One card per proposed new item
- Edit title, category, family, estimated value, description, provenance
- Slug auto-fills from title — only change if needed
- Check "Not an artifact" to skip a card (e.g. screenshots, duplicates)

### 6. Publish

Click **Publish All** — creates artifact records + uploads photos to Supabase

### 7. Verify

Go to `artifacts.jameslandreth.com/admin` and confirm new items appear

---

## Tips

- Vision results are cached — re-running is fast if something goes wrong
- If port 3848 is busy: `lsof -ti:3848 | xargs kill -9`, then re-run
- If you get slug conflicts, the browser will highlight them in red — just
  edit the slug field
- You can run ingest again after publishing to add more photos; existing
  `submitted` state will block re-submit
  - To re-run: `rm tmp/ingest-state.json`
