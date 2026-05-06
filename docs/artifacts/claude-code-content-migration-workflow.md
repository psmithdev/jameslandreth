# Artifact Upload and Content Migration Workflow

This workflow covers two related jobs:

- Jim uploading individual artifacts directly to `artifacts.jameslandreth.com`.
- Jim and Aleda organizing large batches of photos so Parker can review or import them later.

The direct upload workflow is the normal self-service path for Jim. The Claude Code batch workflow is for larger or messier groups of photos that need sorting before upload.

## Jim Self-Service Upload Workflow

Use this when Jim is adding one artifact at a time.

### Parker Setup Checklist

Before Jim can upload:

- Jim needs a Supabase Auth account for the site.
- Jim's row in `profiles` must have `role` set to `admin`.
- Jim should sign in at `https://artifacts.jameslandreth.com/login`.
- After signing in, Jim should be able to open `https://artifacts.jameslandreth.com/admin`.

### Upload One Artifact

1. Go to `https://artifacts.jameslandreth.com/admin`.
2. Sign in if prompted.
3. Click `+ Add New Item`.
4. Fill in the required fields:

   - `Title`
   - `Category`

5. Fill in optional fields when known:

   - `Family`
   - `Estimated Value`
   - `Description`
   - `Provenance`

6. Add 1 to 3 clear photos.
7. Click `Add Item`.
8. Open the new item from the admin list.
9. Confirm the title, category, description, and photos look right on the public item page.

New uploads are created with status `available`.

### Field Guidelines

- Use a specific title that identifies the item, such as `Blue Glass Kerosene Oil Lamp`, not `Lamp`.
- Choose the closest existing category from the category list below.
- Leave optional fields blank if the answer is not known.
- Do not guess family history, maker, age, or provenance.
- Put only factual history in `Provenance`.
- Put visible details and practical description in `Description`.
- Use `Estimated Value` only when Jim or Aleda has a real estimate.

### Photo Guidelines

- Upload 1 to 3 photos per artifact.
- Use clear photos where the item fills most of the frame.
- Prefer front, side/detail, and maker-mark photos when available.
- Do not upload blurry duplicates.
- Do not upload room-overview photos unless the item is easy to identify.

### Troubleshooting

- If `/admin` sends Jim to login, sign in at `https://artifacts.jameslandreth.com/login`.
- If login succeeds but `/admin` still redirects, Parker should confirm Jim's `profiles.role` is `admin`.
- If an upload fails, try fewer photos first.
- If a duplicate-title upload fails, use a more specific title so the generated slug is unique.
- If a photo is sideways or too large, Parker can re-upload a cleaned version from the item page.

## Claude Code Batch Prep Workflow

Use this when a large group of household artifact photos needs to be sorted before upload.

## Goal

For every artifact, create one folder containing:

- 1 to 3 photos of the item
- 1 text file with the required artifact fields

## Folder Structure

Create one working folder per batch:

```text
Artifact Batch - Group Travel/
  01-victorian-writing-desk/
    artifact.txt
    photo-1.jpg
    photo-2.jpg
    photo-3.jpg
  02-blue-glass-oil-lamp/
    artifact.txt
    photo-1.jpg
    photo-2.jpg
```

Use short folder names:

- Start with a two-digit number.
- Use lowercase words.
- Separate words with hyphens.
- Keep one artifact per folder.

## Required Artifact Fields

Each `artifact.txt` file should use this template:

```text
Title:
Category:
Family:
Estimated Value:
Status:
Description:
Provenance & History:
Photo Notes:
```

Status should be one of:

- `available`
- `claimed`
- `gifted`

Use `unknown` when a field cannot be filled yet.

## Step-by-Step Workflow

1. Copy one manageable batch of photos into a new working folder.

   Recommended batch size: 20 to 40 photos.

2. Remove obvious non-artifact photos.

   Skip blurry duplicates, accidental screenshots, room overviews that do not identify a specific object, and photos that only show clutter.

3. Group photos by object.

   Put all photos of the same object into the same artifact folder. Keep 1 to 3 of the clearest photos.

4. Rename photos inside each folder.

   Use:

   ```text
   photo-1.jpg
   photo-2.jpg
   photo-3.jpg
   ```

5. Create `artifact.txt` in each folder.

   Fill in what is known. Leave `unknown` for missing value, family, or provenance.

6. Review the folders before sending to Parker.

   Each folder should have exactly one `artifact.txt` and 1 to 3 photos.

## Claude Code Prompt

Use this prompt after opening Claude Code in the batch folder:

```text
Organize this artifact photo batch.

For each distinct artifact:
- Create one folder named with a two-digit number and short slug.
- Move 1 to 3 useful photos of that artifact into the folder.
- Create artifact.txt using this exact template:

Title:
Category:
Family:
Estimated Value:
Status:
Description:
Provenance & History:
Photo Notes:

Rules:
- Keep one artifact per folder.
- Use status available unless the notes clearly say claimed or gifted.
- Use unknown for missing category, family, value, or provenance.
- Do not invent family history.
- Prefer clear object photos over room overview photos.
- Put uncertain photos in a folder named needs-review.
- At the end, list every created folder and anything that still needs human review.
```

## Review Checklist

Before the batch is considered ready:

- Every artifact has its own folder.
- Every folder has `artifact.txt`.
- Every artifact has 1 to 3 photos.
- The title is specific enough to identify the item.
- Category is one of the known site categories, or `unknown`.
- Status is `available`, `claimed`, or `gifted`.
- Provenance is factual, not guessed.
- Unclear items are in `needs-review`.

## Category List

Use the closest category:

- Books & Documents
- China & Porcelain
- Furniture
- Glassware & Crystal
- Jewelry & Accessories
- Kitchenware
- Lighting
- Linens & Textiles
- Musical Instruments
- Paintings & Art
- Tools & Equipment
- Miscellaneous

## Handoff to Parker

When a batch is ready, send Parker:

- The whole batch folder
- Any `needs-review` folder
- A short note naming the source folder and what changed

Example note:

```text
This is Group Travel, first pass. I grouped 18 artifacts, left 6 uncertain photos in needs-review, and marked two items as claimed.
```

## Scaling Rules

Do not process hundreds of photos in one pass. Work in batches:

- 20 to 40 photos for a normal batch
- 10 to 20 photos for confusing categories
- One category at a time whenever possible

This keeps mistakes easy to catch and makes review faster.

## Parker Bulk Publish Workflow

For large batches, Parker can publish reviewed photos through the local ingest pipeline instead of Jim uploading items one at a time.

1. Put source photos in `tmp/artifact-photos/`.
2. Optionally put collector notes in the same folder as a `.docx` file or a text file with `description` in the filename.
3. Confirm `.env` points at the correct Supabase project and includes:

   ```text
   PUBLIC_SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ANTHROPIC_API_KEY=
   ```

4. Run:

   ```bash
   npm run ingest
   ```

5. Review the browser UI at `http://localhost:3848`.
6. Edit matches, titles, slugs, categories, descriptions, provenance, and photo assignments.
7. Click `Publish All`.
8. Check `https://artifacts.jameslandreth.com` after publishing.

This creates Supabase artifact records, uploads resized photos to the `artifacts` storage bucket, and stores public image URLs on each artifact. No code deploy is needed for content-only artifact uploads.
