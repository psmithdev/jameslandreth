# Vision-Based Artifact Photo Classifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude vision-based auto-classification of artifact photos with a browser review UI, replacing manual filename→slug mapping.

**Architecture:** Two new CLI scripts extend the existing upload pipeline. `classify-photos.mjs` sends photos to Claude vision API in batches, writes proposals JSON. `review-photos.mjs` serves a local HTML page for human review, outputs the mapping JSON consumed by the existing `upload-artifact-photos.mjs`.

**Tech Stack:** Node.js ESM, @anthropic-ai/sdk (Claude vision), sharp (thumbnails), @supabase/supabase-js (artifact metadata), vanilla HTML/CSS/JS (review UI)

**Spec:** `docs/superpowers/specs/2026-03-24-vision-photo-classifier-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/classify-photos.mjs` | Scan photos, thumbnail via sharp, batch-send to Claude vision, write proposals JSON |
| Create | `scripts/review-photos.mjs` | HTTP server serving review UI, photo files, and submit endpoint |
| Modify | `package.json` | Add `classify-photos`, `review-photos` scripts; add `@anthropic-ai/sdk` devDep |
| Modify | `.env.example` | Add `ANTHROPIC_API_KEY` |

---

### Task 1: Install dependency and update config

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install @anthropic-ai/sdk**

```bash
npm install --save-dev @anthropic-ai/sdk
```

- [ ] **Step 2: Add npm scripts to package.json**

Add these two entries to the `"scripts"` section in `package.json`:

```json
"classify-photos": "node scripts/classify-photos.mjs",
"review-photos": "node scripts/review-photos.mjs"
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to .env.example**

Append to `.env.example`:

```
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Also add the actual key to `.env` (not committed).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Add @anthropic-ai/sdk and classify/review npm scripts"
```

---

### Task 2: Create classify-photos.mjs — scaffolding and file scanning

**Files:**
- Create: `scripts/classify-photos.mjs`

This task builds the script skeleton: env loading, Supabase client, image file scanning, and resumability (skipping already-classified files).

- [ ] **Step 1: Create the script with env loading, file scanning, and resumability**

Create `scripts/classify-photos.mjs`:

```javascript
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

// ── Config ──────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = join(ROOT, 'tmp', 'artifact-photos');
const PROPOSALS_FILE = join(ROOT, 'tmp', 'photo-proposals.json');
const ENV_FILE = join(ROOT, '.env');

const BATCH_SIZE = 5;
const THUMB_WIDTH = 512;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp']);

// ── Parse .env ──────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    console.error(`Missing ${filePath} — copy .env.example and fill in credentials`);
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv(ENV_FILE);

const SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

// ── Clients ─────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Helpers ─────────────────────────────────────────────────────────
function loadProposals() {
  if (!existsSync(PROPOSALS_FILE)) return null;
  try {
    return JSON.parse(readFileSync(PROPOSALS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveProposals(data) {
  writeFileSync(PROPOSALS_FILE, JSON.stringify(data, null, 2) + '\n');
}

async function createThumbnail(filePath) {
  const buffer = await sharp(filePath)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buffer.toString('base64');
}

function buildPrompt(artifacts) {
  const list = artifacts.map((a) =>
    `- slug: "${a.slug}" | title: "${a.title}" | category: ${a.category} | description: ${a.description || 'N/A'} | provenance: ${a.provenance || 'N/A'}`
  ).join('\n');

  return `You are classifying photos of family heirlooms and antiques. Here are the artifacts in our collection:

${list}

For each numbered photo below, identify which artifact it most likely depicts. If a photo does not match any artifact (e.g. screenshots, selfies, unrelated objects), use null.

Return ONLY a JSON array with one entry per photo:
[{ "index": 0, "slug": "artifact-slug-or-null", "confidence": 0.0, "reasoning": "one sentence" }]

Confidence guide: 0.9+ = very certain match, 0.7-0.9 = likely match, 0.5-0.7 = possible match, <0.5 = uncertain, 0 = no match.`;
}

async function classifyBatch(filenames, artifacts) {
  const content = [];

  // Add text prompt
  content.push({ type: 'text', text: buildPrompt(artifacts) });

  // Add each image with its index label (skip files that fail thumbnail creation)
  const validIndices = [];
  for (let i = 0; i < filenames.length; i++) {
    try {
      const base64 = await createThumbnail(join(PHOTO_DIR, filenames[i]));
      content.push({ type: 'text', text: `\nPhoto ${validIndices.length}: ${filenames[i]}` });
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      });
      validIndices.push(i);
    } catch (err) {
      console.warn(`  ⚠  ${filenames[i]}: thumbnail failed (${err.message}), skipping`);
    }
  }

  if (validIndices.length === 0) {
    return { results: [], validIndices: [] };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  });

  // Extract JSON from response
  const text = response.content.find((b) => b.type === 'text')?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`No JSON array found in response: ${text.slice(0, 200)}`);
  }
  return { results: JSON.parse(jsonMatch[0]), validIndices };
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  // Validate photo directory
  if (!existsSync(PHOTO_DIR)) {
    console.error(`Photo directory not found: ${PHOTO_DIR}`);
    console.error('Download photos first: mkdir -p tmp/artifact-photos && rclone copy ...');
    process.exit(1);
  }

  // Fetch artifacts from Supabase
  const { data: artifacts, error: fetchErr } = await supabase
    .from('artifacts')
    .select('slug, title, category, description, provenance');

  if (fetchErr || !artifacts?.length) {
    console.error('Failed to fetch artifacts:', fetchErr?.message || 'no data');
    process.exit(1);
  }
  console.log(`Loaded ${artifacts.length} artifacts from database`);

  // Scan for image files
  const allFiles = readdirSync(PHOTO_DIR)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  if (allFiles.length === 0) {
    console.error(`No image files found in ${PHOTO_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${allFiles.length} image files`);

  // Load existing proposals for resumability
  const existing = loadProposals();
  const alreadyClassified = new Set(
    existing?.proposals?.map((p) => p.filename) || []
  );

  const toClassify = allFiles.filter((f) => !alreadyClassified.has(f));
  if (toClassify.length === 0) {
    console.log('All photos already classified. Delete tmp/photo-proposals.json to re-run.');
    return;
  }
  console.log(`${toClassify.length} photos to classify (${alreadyClassified.size} already done)`);

  // Process in batches
  const proposals = existing?.proposals || [];

  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
    const batch = toClassify.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toClassify.length / BATCH_SIZE);
    console.log(`\nBatch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);

    try {
      const { results, validIndices } = await classifyBatch(batch, artifacts);

      // Track which batch files got a result
      const covered = new Set();

      for (const result of results) {
        // Map response index back to original batch index
        const batchIdx = validIndices[result.index];
        const filename = batch[batchIdx];
        if (!filename) continue;
        covered.add(batchIdx);

        // Validate slug exists
        const validSlug = result.slug === null || artifacts.some((a) => a.slug === result.slug);
        proposals.push({
          filename,
          slug: validSlug ? result.slug : null,
          confidence: result.confidence ?? 0,
          reasoning: result.reasoning || '',
        });
        const icon = result.slug ? '✓' : '·';
        console.log(`  ${icon}  ${filename} → ${result.slug || 'unmatched'} (${(result.confidence * 100).toFixed(0)}%)`);
      }

      // Add fallback entries for files not covered by API response
      for (let j = 0; j < batch.length; j++) {
        if (!covered.has(j)) {
          proposals.push({
            filename: batch[j],
            slug: null,
            confidence: 0,
            reasoning: 'Classification failed: no result returned by API',
          });
          console.log(`  ⚠  ${batch[j]} → no result from API, marked unmatched`);
        }
      }

      // Save after each batch (resume-safe)
      saveProposals({
        generated: new Date().toISOString(),
        model: 'claude-sonnet-4-6',
        artifact_count: artifacts.length,
        proposals,
      });
    } catch (err) {
      console.error(`  ✗  Batch failed: ${err.message}`);
      // Add fallback entries for entire failed batch
      for (const f of batch) {
        proposals.push({
          filename: f,
          slug: null,
          confidence: 0,
          reasoning: `Batch classification failed: ${err.message}`,
        });
      }
      saveProposals({
        generated: new Date().toISOString(),
        model: 'claude-sonnet-4-6',
        artifact_count: artifacts.length,
        proposals,
      });
    }

    // Brief delay between batches to avoid rate limits
    if (i + BATCH_SIZE < toClassify.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Summary
  const matched = proposals.filter((p) => p.slug !== null).length;
  const unmatched = proposals.filter((p) => p.slug === null).length;
  console.log('\n── Summary ──');
  console.log(`Total:     ${proposals.length}`);
  console.log(`Matched:   ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`\nProposals saved to ${PROPOSALS_FILE}`);
  console.log('Next step: npm run review-photos');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify script loads without errors**

```bash
node scripts/classify-photos.mjs 2>&1 | head -5
```

Expected: Should show "Photo directory not found" error (since `tmp/artifact-photos/` is empty/missing). This confirms the script parses correctly and env loading works.

- [ ] **Step 3: Commit**

```bash
git add scripts/classify-photos.mjs
git commit -m "Add classify-photos script with Claude vision integration"
```

---

### Task 3: Create review-photos.mjs — HTTP server and API routes

**Files:**
- Create: `scripts/review-photos.mjs`

This task builds the Node HTTP server with routes for serving proposals, photos, artifacts, and the submit endpoint.

- [ ] **Step 1: Create the server script**

Create `scripts/review-photos.mjs`:

```javascript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = join(ROOT, 'tmp', 'artifact-photos');
const PROPOSALS_FILE = join(ROOT, 'tmp', 'photo-proposals.json');
const MAP_FILE = join(ROOT, 'scripts', 'artifact-photo-map.json');
const ENV_FILE = join(ROOT, '.env');
const PORT = 3847;

// ── Parse .env ──────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    console.error(`Missing ${filePath}`);
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv(ENV_FILE);
const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── MIME types ───────────────────────────────────────────────────────
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
};

// ── Route handlers ──────────────────────────────────────────────────
function serveHTML(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(buildHTML());
}

function servePhoto(res, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    res.writeHead(400);
    res.end('Invalid filename');
    return;
  }
  const filePath = join(PHOTO_DIR, safeName);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = extname(safeName).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
}

function serveProposals(res) {
  if (!existsSync(PROPOSALS_FILE)) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'No proposals file. Run: npm run classify-photos' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(readFileSync(PROPOSALS_FILE, 'utf-8'));
}

async function serveArtifacts(res) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('slug, title, category')
    .order('title');

  if (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleSubmit(req, res, server) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  // Validate shape: { string: string[] }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Expected object with slug → filename[] entries' }));
    return;
  }

  writeFileSync(MAP_FILE, JSON.stringify(body, null, 2) + '\n');
  const totalFiles = Object.values(body).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\nMapping saved: ${totalFiles} photos → ${Object.keys(body).length} artifacts`);
  console.log(`Written to ${MAP_FILE}`);
  console.log('Next step: npm run upload-photos');

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, file: MAP_FILE }));

  // Shut down gracefully after response is sent
  setTimeout(() => {
    server.close(() => process.exit(0));
  }, 100);
}

// ── HTML page ───────────────────────────────────────────────────────
function buildHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Artifact Photo Review</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .summary { color: #666; margin-bottom: 24px; font-size: 14px; }
  .section-title { font-size: 18px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #ddd; }
  .artifact-group { margin-bottom: 32px; }
  .artifact-group h3 { font-size: 15px; color: #555; margin-bottom: 8px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card img { width: 100%; height: 200px; object-fit: cover; display: block; }
  .card-body { padding: 12px; }
  .card-filename { font-size: 12px; color: #999; margin-bottom: 4px; font-family: monospace; }
  .card-reasoning { font-size: 13px; color: #666; margin-bottom: 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-high { background: #d4edda; color: #155724; }
  .badge-mid { background: #fff3cd; color: #856404; }
  .badge-low { background: #f8d7da; color: #721c24; }
  .card-controls { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .card-controls select { flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
  .card-controls input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
  .submit-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 16px 24px; box-shadow: 0 -2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .submit-bar button { background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 600; }
  .submit-bar button:hover { background: #1d4ed8; }
  .submit-bar button:disabled { background: #94a3b8; cursor: not-allowed; }
  .submit-count { font-size: 14px; color: #666; }
  .content { padding-bottom: 80px; }
  .loading { text-align: center; padding: 48px; color: #999; }
</style>
</head>
<body>
<div class="content" id="app">
  <div class="loading">Loading proposals...</div>
</div>
<div class="submit-bar">
  <span class="submit-count" id="submit-count"></span>
  <button id="submit-btn" onclick="submitMapping()">Save Mapping & Exit</button>
</div>

<script>
let proposals = [];
let artifacts = [];

async function init() {
  try {
    const [propRes, artRes] = await Promise.all([
      fetch('/proposals').then(r => r.json()),
      fetch('/artifacts').then(r => r.json()),
    ]);
    proposals = propRes.proposals || [];
    artifacts = artRes;
    render();
  } catch (err) {
    document.getElementById('app').innerHTML = '<p style="color:red">Failed to load: ' + err.message + '</p>';
  }
}

function badgeClass(c) {
  if (c > 0.8) return 'badge-high';
  if (c >= 0.5) return 'badge-mid';
  return 'badge-low';
}

function artifactOptions(selectedSlug) {
  let html = '<option value="">— dismiss —</option>';
  for (const a of artifacts) {
    const sel = a.slug === selectedSlug ? ' selected' : '';
    html += '<option value="' + a.slug + '"' + sel + '>' + a.title + ' (' + a.category + ')</option>';
  }
  return html;
}

function render() {
  const matched = proposals.filter(p => p.slug !== null);
  const unmatched = proposals.filter(p => p.slug === null);

  // Group matched by slug
  const groups = {};
  for (const p of matched) {
    if (!groups[p.slug]) groups[p.slug] = [];
    groups[p.slug].push(p);
  }

  let html = '<h1>Artifact Photo Review</h1>';
  html += '<p class="summary">' + proposals.length + ' photos analyzed, ' + matched.length + ' matched, ' + unmatched.length + ' unmatched</p>';

  // Matched
  if (matched.length > 0) {
    html += '<div class="section-title">Matched Photos</div>';
    for (const slug of Object.keys(groups).sort()) {
      const art = artifacts.find(a => a.slug === slug);
      const title = art ? art.title : slug;
      html += '<div class="artifact-group"><h3>' + title + '</h3><div class="cards">';
      for (const p of groups[slug]) {
        html += cardHTML(p);
      }
      html += '</div></div>';
    }
  }

  // Unmatched
  if (unmatched.length > 0) {
    html += '<div class="section-title">Unmatched Photos</div>';
    html += '<div class="cards">';
    for (const p of unmatched) {
      html += cardHTML(p);
    }
    html += '</div>';
  }

  document.getElementById('app').innerHTML = html;
  updateCount();
}

function cardHTML(p) {
  const checked = p.slug && p.confidence > 0.8 ? ' checked' : '';
  return '<div class="card">' +
    '<img src="/photos/' + encodeURIComponent(p.filename) + '" loading="lazy" />' +
    '<div class="card-body">' +
      '<div class="card-filename">' + p.filename + ' <span class="badge ' + badgeClass(p.confidence) + '">' + Math.round(p.confidence * 100) + '%</span></div>' +
      '<div class="card-reasoning">' + (p.reasoning || '') + '</div>' +
      '<div class="card-controls">' +
        '<select data-filename="' + p.filename + '" onchange="updateCount()">' + artifactOptions(p.slug) + '</select>' +
        '<input type="checkbox" data-filename="' + p.filename + '"' + checked + ' onchange="updateCount()" title="Include in mapping" />' +
      '</div>' +
    '</div></div>';
}

function updateCount() {
  const checked = document.querySelectorAll('input[type="checkbox"]:checked');
  let count = 0;
  checked.forEach(cb => {
    const sel = document.querySelector('select[data-filename="' + cb.dataset.filename + '"]');
    if (sel && sel.value) count++;
  });
  document.getElementById('submit-count').textContent = count + ' photo(s) selected';
  document.getElementById('submit-btn').disabled = count === 0;
}

async function submitMapping() {
  const mapping = {};
  const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach(cb => {
    const filename = cb.dataset.filename;
    const sel = document.querySelector('select[data-filename="' + filename + '"]');
    if (!sel || !sel.value) return;
    const slug = sel.value;
    if (!mapping[slug]) mapping[slug] = [];
    mapping[slug].push(filename);
  });

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('app').innerHTML =
        '<div style="text-align:center;padding:48px">' +
        '<h2>Mapping saved!</h2>' +
        '<p style="color:#666;margin-top:8px">Written to scripts/artifact-photo-map.json</p>' +
        '<p style="color:#666;margin-top:4px">Next: <code>npm run upload-photos</code></p>' +
        '</div>';
      document.querySelector('.submit-bar').style.display = 'none';
    }
  } catch (err) {
    btn.textContent = 'Save Mapping & Exit';
    btn.disabled = false;
    alert('Error: ' + err.message);
  }
}

init();
</script>
</body>
</html>`;
}

// ── Server ──────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(PROPOSALS_FILE)) {
    console.error(`No proposals file found at ${PROPOSALS_FILE}`);
    console.error('Run classify first: npm run classify-photos');
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    try {
      if (req.method === 'GET' && url.pathname === '/') {
        serveHTML(res);
      } else if (req.method === 'GET' && url.pathname.startsWith('/photos/')) {
        const filename = decodeURIComponent(url.pathname.slice('/photos/'.length));
        servePhoto(res, filename);
      } else if (req.method === 'GET' && url.pathname === '/proposals') {
        serveProposals(res);
      } else if (req.method === 'GET' && url.pathname === '/artifacts') {
        await serveArtifacts(res);
      } else if (req.method === 'POST' && url.pathname === '/submit') {
        await handleSubmit(req, res, server);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      console.error('Request error:', err);
      res.writeHead(500);
      res.end('Internal error');
    }
  });

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Review UI running at ${url}`);
    console.log('Press Ctrl+C to quit without saving.\n');

    // Auto-open browser
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${cmd} ${url}`, () => {});
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify script loads without errors**

```bash
node scripts/review-photos.mjs 2>&1 | head -3
```

Expected: "No proposals file found" error (since `tmp/photo-proposals.json` doesn't exist). Confirms the script parses correctly.

- [ ] **Step 3: Commit**

```bash
git add scripts/review-photos.mjs
git commit -m "Add review-photos script with browser UI for artifact mapping"
```

---

### Task 4: End-to-end verification

Manual verification after all scripts are in place.

- [ ] **Step 1: Place test images in tmp/artifact-photos/**

Download or copy a few test images into `tmp/artifact-photos/`. Even stock photos will work to verify the pipeline.

- [ ] **Step 2: Run classify-photos**

```bash
npm run classify-photos
```

Expected: Script fetches artifacts from Supabase, processes images in batches of 5, writes `tmp/photo-proposals.json` with classifications.

- [ ] **Step 3: Verify proposals file**

```bash
cat tmp/photo-proposals.json | head -30
```

Expected: JSON with `generated`, `model`, `artifact_count`, and `proposals` array. Each proposal has `filename`, `slug`, `confidence`, `reasoning`.

- [ ] **Step 4: Run review-photos**

```bash
npm run review-photos
```

Expected: Browser opens at `http://localhost:3847`. Shows photo cards grouped by artifact with confidence badges. Unmatched photos in separate section.

- [ ] **Step 5: Approve and submit in browser**

Check/uncheck photos, reassign via dropdowns, click "Save Mapping & Exit".

Expected: `scripts/artifact-photo-map.json` written with slug→filename arrays. Server shuts down.

- [ ] **Step 6: Run upload-photos**

```bash
npm run upload-photos
```

Expected: Images uploaded to Supabase Storage, artifact `images` arrays updated. Verify in Supabase Dashboard and `npm run dev` → `/artifacts`.
