# Vision-Based Artifact Photo Classifier

## Problem

The artifact photo upload pipeline requires manually mapping filenames (IMG_xxxx.jpg) to artifact slugs via `scripts/artifact-photo-map.json`. With hundreds of photos this is tedious and error-prone. We need an automated classification step that uses computer vision to suggest which artifact each photo depicts.

## Solution

A two-script extension to the existing upload pipeline:

1. **`classify-photos.mjs`** — Sends each photo to Claude vision API with artifact metadata, writes proposed mappings to `tmp/photo-proposals.json`
2. **`review-photos.mjs`** — Serves a local browser UI for reviewing/approving proposals, writes final `scripts/artifact-photo-map.json`

The existing `upload-artifact-photos.mjs` script remains unchanged — it reads the mapping and uploads.

## Pipeline

```
tmp/artifact-photos/*.jpg  ──classify──>  tmp/photo-proposals.json
                                               │
tmp/artifact-photos/*.jpg  ──review UI──>  scripts/artifact-photo-map.json
                                               │
                                          ──upload──>  Supabase Storage + DB
```

```bash
npm run classify-photos   # Claude vision → proposals
npm run review-photos     # Browser UI → mapping JSON
npm run upload-photos     # Existing upload to Supabase
```

## Script 1: `scripts/classify-photos.mjs`

### Inputs
- `tmp/artifact-photos/` — directory of photos (jpg, jpeg, png, heic, heif, webp)
- `.env` — `ANTHROPIC_API_KEY` for Claude vision, Supabase creds for fetching artifact metadata
- Supabase `artifacts` table — slug, title, category, description, provenance

### Process
1. Parse `.env` for `ANTHROPIC_API_KEY` and Supabase credentials
2. Create Supabase client (service role), fetch all artifacts with metadata fields
3. Scan `tmp/artifact-photos/` for image files
4. Skip files already present in `tmp/photo-proposals.json` (resumability)
5. For each image:
   - Create 512px-wide JPEG thumbnail via sharp (all formats including HEIC converted to JPEG for API compatibility)
   - Convert to base64 with `image/jpeg` media type
6. Batch 5 images per Claude API call with prompt:

   > "You are classifying photos of family heirlooms. Here are the artifacts in our collection:
   > [For each artifact: slug, title, category, description, provenance]
   >
   > For each numbered photo, identify which artifact it most likely depicts.
   > Return JSON array: [{ "index": 0, "slug": "artifact-slug" | null, "confidence": 0.0-1.0, "reasoning": "one sentence" }]
   > Use null for photos that don't match any artifact."

7. Merge results into proposals file
8. Log progress and summary

### Output: `tmp/photo-proposals.json`
```json
{
  "generated": "2026-03-24T12:00:00Z",
  "model": "claude-sonnet-4-6",
  "artifact_count": 8,
  "proposals": [
    {
      "filename": "IMG_1234.jpg",
      "slug": "brass-candlestick-pair",
      "confidence": 0.92,
      "reasoning": "Shows a pair of tall brass candlesticks with engravings and aged patina"
    },
    {
      "filename": "IMG_9999.jpg",
      "slug": null,
      "confidence": 0,
      "reasoning": "Appears to be an unrelated screenshot"
    }
  ]
}
```

### Error Handling
- API call failure: log error, continue with remaining images
- Partial results: existing proposals preserved, re-run picks up unclassified photos
- Invalid image: log warning, skip

## Script 2: `scripts/review-photos.mjs`

### Architecture
Minimal Node HTTP server (no framework) serving a single HTML page with inline CSS/JS.

### Server
- Port: `localhost:3847`
- Routes:
  - `GET /` — HTML review page
  - `GET /photos/:filename` — serves images from `tmp/artifact-photos/`
  - `GET /proposals` — serves `tmp/photo-proposals.json`
  - `GET /artifacts` — fetches artifact list from Supabase (slug, title, category)
  - `POST /submit` — receives approved mapping, writes `scripts/artifact-photo-map.json`, responds with success, then shuts down server on next tick
- Auto-opens browser on start (`open` on macOS, `xdg-open` on Linux)

### UI Layout
- **Header**: Summary — "X photos analyzed, Y matched, Z unmatched, W dismissed"
- **Matched section**: Cards grouped by artifact slug
  - Photo thumbnail
  - Proposed artifact title + confidence badge (green >0.8, yellow 0.5-0.8, red <0.5)
  - Claude's reasoning text
  - Dropdown to reassign to different artifact or "dismiss"
  - Checkbox to approve (pre-checked for confidence >0.8)
- **Unmatched section**: Photos with `slug: null`
  - Same card layout
  - Dropdown to manually assign an artifact or leave dismissed
- **Submit button**: Collects approved mappings, POSTs to `/submit`

### Output: `scripts/artifact-photo-map.json`
Standard format consumed by existing upload script:
```json
{
  "brass-candlestick-pair": ["IMG_1234.jpg", "IMG_1235.jpg"],
  "myrna-allen-oil-paintings": ["IMG_1240.jpg"]
}
```

First filename per slug becomes the hero image (order preserved from review UI). Submit replaces the file entirely (not merge) — the review UI shows all proposals including any from a previous run.

## File Changes

| Action | File | Detail |
|--------|------|--------|
| Create | `scripts/classify-photos.mjs` | Vision classification script |
| Create | `scripts/review-photos.mjs` | Browser review UI server |
| Modify | `package.json` | Add `classify-photos`, `review-photos` scripts; add `@anthropic-ai/sdk` devDep |
| Modify | `.env.example` | Add `ANTHROPIC_API_KEY` |
| — | `.gitignore` | No change needed — `tmp/` already covers `tmp/photo-proposals.json` |

## Dependencies

- `@anthropic-ai/sdk` (new, dev) — Claude vision API
- `sharp` (existing, dev) — thumbnail generation for API
- `@supabase/supabase-js` (existing) — fetch artifact metadata

## Verification

1. Place test images in `tmp/artifact-photos/`
2. Run `npm run classify-photos` — verify `tmp/photo-proposals.json` has entries with slugs, confidence scores, reasoning
3. Run `npm run review-photos` — browser opens, photos displayed grouped by artifact with confidence badges
4. Approve/reassign in UI, submit — verify `scripts/artifact-photo-map.json` written correctly
5. Run `npm run upload-photos` — verify images uploaded to Supabase Storage and DB updated
6. Visit `/artifacts` in dev server — verify images display on cards and detail pages
