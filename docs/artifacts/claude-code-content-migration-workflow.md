# Claude Code Artifact Content Migration Workflow

This workflow is for turning large batches of household artifact photos into organized artifact folders that Parker can import or review later. It is designed so Jim and Aleda can repeat the same process for each category without needing a custom plan each time.

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
- `sold`

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
- Use status available unless the notes clearly say claimed or sold.
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
- Status is `available`, `claimed`, or `sold`.
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
