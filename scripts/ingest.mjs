/**
 * ingest.mjs — All-in-one artifact ingest pipeline
 *
 * Replaces: classify-photos → review-photos → propose-artifacts → upload-photos
 *
 * Usage:  npm run ingest
 *
 * 1. Claude vision matches photos to existing artifacts
 * 2. Claude vision groups unmatched photos → drafts new artifact records
 * 3. Browser opens — review/edit everything visually
 * 4. "Publish All" → creates DB records + uploads photos
 *
 * Delete tmp/ingest-state.json to force fresh analysis.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname, basename, join } from 'node:path';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

// ── Config ──────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = join(ROOT, 'tmp', 'artifact-photos');
const STATE_FILE = join(ROOT, 'tmp', 'ingest-state.json');
const VISION_CACHE_FILE = join(ROOT, 'tmp', 'vision-cache.json');
const ENV_FILE = join(ROOT, '.env');
const PORT = 3848;
const BUCKET = 'artifacts';
const CLASSIFY_BATCH = 5;
const PROPOSE_BATCH = 8;
const THUMB_WIDTH = 512;
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 85;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp']);
const HEIC_EXTS = new Set(['.heic', '.heif']);

const CATEGORIES = [
  'Furniture', 'China & Porcelain', 'Glassware & Crystal', 'Paintings & Art',
  'Books & Documents', 'Tools & Equipment', 'Jewelry & Accessories',
  'Linens & Textiles', 'Kitchenware', 'Lighting', 'Musical Instruments', 'Miscellaneous',
];

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
const { PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } = env;

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

// ── State helpers ────────────────────────────────────────────────────
function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')); } catch { return null; }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ── Vision cache (persists across state resets) ──────────────────────
// Keyed by "filename::artifactsHash" so the same photo reused with a
// different artifact DB gets re-classified automatically.
function loadVisionCache() {
  if (!existsSync(VISION_CACHE_FILE)) return {};
  try { return JSON.parse(readFileSync(VISION_CACHE_FILE, 'utf-8')); } catch { return {}; }
}

function saveVisionCache(cache) {
  writeFileSync(VISION_CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
}

function artifactsHash(artifacts) {
  return artifacts.map((a) => a.slug).sort().join(',');
}

function cacheKey(filename, hash) {
  return `${filename}::${hash}`;
}

// ── String helpers ───────────────────────────────────────────────────
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Image helpers ────────────────────────────────────────────────────
async function createThumbnail(filePath) {
  const buffer = await sharp(filePath)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buffer.toString('base64');
}

async function processImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  let pipeline = sharp(filePath);
  if (HEIC_EXTS.has(ext)) {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY });
  }
  pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (!HEIC_EXTS.has(ext)) {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY });
  }
  const buffer = await pipeline.toBuffer();
  return { buffer, outputExt: 'jpg', contentType: 'image/jpeg' };
}

// ── Classify pass ────────────────────────────────────────────────────
function buildClassifyPrompt(artifacts) {
  const list = artifacts.map((a) =>
    `- slug: "${a.slug}" | title: "${a.title}" | category: ${a.category} | description: ${a.description || 'N/A'}`
  ).join('\n');
  return `You are classifying photos of family heirlooms and antiques. Here are the artifacts in our collection:

${list}

For each numbered photo below, identify which artifact it most likely depicts. If a photo does not match any listed artifact, use null.

Return ONLY a JSON array with one entry per photo:
[{ "index": 0, "slug": "artifact-slug-or-null", "confidence": 0.0, "reasoning": "one sentence" }]

Confidence: 0.9+ very certain, 0.7–0.9 likely, 0.5–0.7 possible, <0.5 uncertain, 0 no match.`;
}

async function classifyBatch(filenames, artifacts) {
  const content = [{ type: 'text', text: buildClassifyPrompt(artifacts) }];
  const validIndices = [];
  for (let i = 0; i < filenames.length; i++) {
    try {
      const base64 = await createThumbnail(join(PHOTO_DIR, filenames[i]));
      content.push({ type: 'text', text: `\nPhoto ${validIndices.length}: ${filenames[i]}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
      validIndices.push(i);
    } catch (err) {
      console.warn(`  ⚠  ${filenames[i]}: thumbnail failed (${err.message}), skipping`);
    }
  }
  if (validIndices.length === 0) return { results: [], validIndices: [] };
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1024,
    messages: [{ role: 'user', content }],
  });
  const text = response.content.find((b) => b.type === 'text')?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  return { results: JSON.parse(jsonMatch[0]), validIndices };
}

async function runClassifyPass(files, artifacts, state) {
  const classified = state.classified || [];
  const done = new Set(classified.map((c) => c.filename));
  const toClassify = files.filter((f) => !done.has(f));
  if (toClassify.length === 0) return;

  const cache = loadVisionCache();
  const aHash = artifactsHash(artifacts);

  // Pull from cache first — no API call needed for known photos
  const needApi = [];
  for (const filename of toClassify) {
    const hit = cache[cacheKey(filename, aHash)];
    if (hit) {
      classified.push({ filename, ...hit });
      console.log(`  ⚡  ${filename} → ${hit.slug || 'unmatched'} (cached)`);
    } else {
      needApi.push(filename);
    }
  }
  state.classified = classified;
  if (classified.length > 0) saveState(state);

  if (needApi.length === 0) {
    console.log('\nClassify pass: all photos served from cache — no API calls needed');
    return;
  }

  console.log(`\nClassify pass: ${needApi.length} photos to classify (${toClassify.length - needApi.length} from cache)`);

  for (let i = 0; i < needApi.length; i += CLASSIFY_BATCH) {
    const batch = needApi.slice(i, i + CLASSIFY_BATCH);
    const batchNum = Math.floor(i / CLASSIFY_BATCH) + 1;
    const total = Math.ceil(needApi.length / CLASSIFY_BATCH);
    console.log(`  Batch ${batchNum}/${total}: ${batch.join(', ')}`);
    try {
      const { results, validIndices } = await classifyBatch(batch, artifacts);
      const covered = new Set();
      for (const r of results) {
        const batchIdx = validIndices[r.index];
        const filename = batch[batchIdx];
        if (!filename) continue;
        covered.add(batchIdx);
        const validSlug = r.slug === null || artifacts.some((a) => a.slug === r.slug);
        const entry = { slug: validSlug ? r.slug : null, confidence: r.confidence ?? 0, reasoning: r.reasoning || '' };
        classified.push({ filename, ...entry });
        cache[cacheKey(filename, aHash)] = entry;
        console.log(`    ${r.slug ? '✓' : '·'}  ${filename} → ${r.slug || 'unmatched'} (${Math.round((r.confidence ?? 0) * 100)}%)`);
      }
      for (let j = 0; j < batch.length; j++) {
        if (!covered.has(j)) {
          const entry = { slug: null, confidence: 0, reasoning: 'No result from API' };
          classified.push({ filename: batch[j], ...entry });
          // Don't cache failures — retry next run
        }
      }
    } catch (err) {
      console.error(`  ✗  Batch failed: ${err.message}`);
      for (const f of batch) {
        classified.push({ filename: f, slug: null, confidence: 0, reasoning: `Batch failed: ${err.message}` });
        // Don't cache failures
      }
    }
    state.classified = classified;
    saveState(state);
    saveVisionCache(cache);
    if (i + CLASSIFY_BATCH < needApi.length) await new Promise((r) => setTimeout(r, 1500));
  }
}

// ── Propose pass ─────────────────────────────────────────────────────
function buildProposePrompt(categories) {
  return `You are cataloging family heirlooms for an online archive. These photos may show one or more distinct objects.

Tasks:
1. Group photos that show the SAME physical object (same item from different angles, or items in a set).
2. For each distinct object or set, draft an artifact record.

Return ONLY a JSON array. Each element:
{
  "title": "concise name (e.g. 'Pressed-Glass Kerosene Table Lamp')",
  "slug": "kebab-case URL slug (e.g. 'pressed-glass-kerosene-table-lamp')",
  "category": "one of: ${categories.join(', ')}",
  "description": "2–3 sentences: what it is, era/style, materials, notable details",
  "provenance": "origin clues from maker marks, labels, style — or null",
  "photos": ["filename1.jpg", "filename2.jpg"]
}

Each photo filename must appear in exactly ONE entry's photos array. Photos below are labeled by index.`;
}

async function proposeBatch(filenames) {
  const content = [{ type: 'text', text: buildProposePrompt(CATEGORIES) }];
  const validFiles = [];
  for (let i = 0; i < filenames.length; i++) {
    try {
      const base64 = await createThumbnail(join(PHOTO_DIR, filenames[i]));
      content.push({ type: 'text', text: `\nPhoto ${validFiles.length}: ${filenames[i]}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
      validFiles.push(filenames[i]);
    } catch (err) {
      console.warn(`  ⚠  ${filenames[i]}: thumbnail failed (${err.message}), skipping`);
    }
  }
  if (validFiles.length === 0) return [];
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 4096,
    messages: [{ role: 'user', content }],
  });
  const text = response.content.find((b) => b.type === 'text')?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 300)}`);
  let raw = jsonMatch[0];
  try {
    return JSON.parse(raw);
  } catch {
    // Truncated response — trim to last complete object and close the array
    const lastClose = raw.lastIndexOf('}');
    if (lastClose === -1) throw new Error('No complete JSON object found in response');
    return JSON.parse(raw.slice(0, lastClose + 1) + ']');
  }
}

async function runProposePass(state) {
  const classifiedSlugs = new Map((state.classified || []).map((c) => [c.filename, c.slug]));
  const assignedToProposal = new Set((state.proposals || []).flatMap((p) => p.photos));
  const unmatched = (state.classified || [])
    .filter((c) => c.slug === null && !assignedToProposal.has(c.filename) && existsSync(join(PHOTO_DIR, c.filename)))
    .map((c) => c.filename);

  if (unmatched.length === 0) return;
  console.log(`\nPropose pass: ${unmatched.length} unmatched photos → drafting new artifact records`);

  const proposals = state.proposals || [];
  let propCounter = proposals.length;

  for (let i = 0; i < unmatched.length; i += PROPOSE_BATCH) {
    const batch = unmatched.slice(i, i + PROPOSE_BATCH);
    console.log(`  Proposing ${batch.length} photos...`);
    try {
      const results = await proposeBatch(batch);
      for (const p of results) {
        const proposal = {
          id: `prop-${propCounter++}`,
          title: p.title || 'Untitled Artifact',
          slug: p.slug || slugify(p.title || 'untitled-artifact'),
          category: CATEGORIES.includes(p.category) ? p.category : 'Miscellaneous',
          description: p.description || '',
          provenance: p.provenance || '',
          photos: (p.photos || []).filter((f) => batch.includes(f)),
        };
        proposals.push(proposal);
        console.log(`  ✓  "${proposal.title}" — ${proposal.photos.length} photo(s)`);
      }
      // Any batch photos not covered by results → add as a stub proposal
      const covered = new Set(results.flatMap((r) => r.photos || []));
      const missed = batch.filter((f) => !covered.has(f));
      if (missed.length > 0) {
        proposals.push({
          id: `prop-${propCounter++}`,
          title: 'Unclassified Item',
          slug: `unclassified-item-${propCounter}`,
          category: 'Miscellaneous',
          description: '',
          provenance: '',
          photos: missed,
        });
      }
    } catch (err) {
      console.error(`  ✗  Propose batch failed: ${err.message}`);
      proposals.push({
        id: `prop-${propCounter++}`,
        title: 'Unclassified Item',
        slug: `unclassified-item-${propCounter}`,
        category: 'Miscellaneous',
        description: '',
        provenance: '',
        photos: batch,
      });
    }
    state.proposals = proposals;
    saveState(state);
    if (i + PROPOSE_BATCH < unmatched.length) await new Promise((r) => setTimeout(r, 1500));
  }
}

// ── HTTP route handlers ──────────────────────────────────────────────
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
};

function serveState(res) {
  if (!existsSync(STATE_FILE)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No state file' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(readFileSync(STATE_FILE, 'utf-8'));
}

async function serveArtifacts(res) {
  const { data, error } = await supabase.from('artifacts').select('slug, title, category').order('title');
  if (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function servePhoto(res, filename) {
  // Use basename only — prevents path traversal without stripping spaces
  const safe = basename(filename);
  if (!safe) { res.writeHead(400); res.end('Bad filename'); return; }
  const filePath = join(PHOTO_DIR, safe);
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const ext = extname(safe).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
}

async function handleSubmit(req, res, server) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString()); }
  catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

  const { matched = {}, newArtifacts = [] } = body;

  // Step 1 — Slug conflict check
  const { data: existing } = await supabase.from('artifacts').select('slug, id, images');
  const existingMap = new Map((existing || []).map((a) => [a.slug, a]));
  const conflicts = newArtifacts.map((a) => a.slug).filter((s) => existingMap.has(s));
  if (conflicts.length > 0) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Slug conflict', conflicts }));
    return;
  }

  let created = 0;
  let uploaded = 0;
  let skipped = 0;
  const errors = [];

  // Step 2 — Insert new artifact records
  const insertedMap = new Map(); // slug → { id, images: [] }
  if (newArtifacts.length > 0) {
    const records = newArtifacts.map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category || 'Miscellaneous',
      family: a.family || null,
      description: a.description || null,
      provenance: a.provenance || null,
      estimated_value: a.estimated_value || null,
      status: 'available',
      images: [],
    }));
    const { data: inserted, error: insertErr } = await supabase
      .from('artifacts').insert(records).select('id, slug');
    if (insertErr) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to insert artifacts: ${insertErr.message}` }));
      return;
    }
    for (const row of inserted || []) {
      insertedMap.set(row.slug, { id: row.id, images: [] });
      created++;
    }
  }

  // Step 3 — Build slug → artifact map (existing + newly inserted)
  const artifactMap = new Map();
  for (const [slug, art] of existingMap) {
    artifactMap.set(slug, { id: art.id, images: art.images || [] });
  }
  for (const [slug, art] of insertedMap) {
    artifactMap.set(slug, art);
  }

  // Collect all photo assignments: Map<slug, filename[]>
  const assignments = new Map();
  for (const [slug, files] of Object.entries(matched)) {
    if (!assignments.has(slug)) assignments.set(slug, []);
    assignments.get(slug).push(...files);
  }
  for (const a of newArtifacts) {
    if (!assignments.has(a.slug)) assignments.set(a.slug, []);
    assignments.get(a.slug).push(...(a.photos || []));
  }

  // Step 4 — Process + upload all photos; collect new URLs per artifact
  const newUrlsMap = new Map(); // slug → string[]
  for (const [slug, files] of assignments) {
    const art = artifactMap.get(slug);
    if (!art) { errors.push({ slug, reason: 'Artifact not found after insert' }); continue; }
    const existingImages = art.images || [];
    newUrlsMap.set(slug, []);

    for (const filename of files) {
      const filePath = join(PHOTO_DIR, filename);
      if (!existsSync(filePath)) {
        errors.push({ filename, reason: 'File not found' });
        continue;
      }
      const baseName = sanitizeName(basename(filename, extname(filename)));
      if (existingImages.some((url) => url.includes(`/${slug}/${baseName}-`))) {
        skipped++;
        continue;
      }
      try {
        const { buffer, outputExt, contentType } = await processImage(filePath);
        const storageName = `${baseName}-${Date.now()}.${outputExt}`;
        const storagePath = `${slug}/${storageName}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET).upload(storagePath, buffer, { contentType, upsert: false });
        if (uploadErr) { errors.push({ filename, reason: uploadErr.message }); continue; }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        newUrlsMap.get(slug).push(urlData.publicUrl);
        uploaded++;
      } catch (err) {
        errors.push({ filename, reason: err.message });
      }
    }
  }

  // Step 5 — Batch update images arrays
  for (const [slug, newUrls] of newUrlsMap) {
    if (newUrls.length === 0) continue;
    const art = artifactMap.get(slug);
    const { error: updateErr } = await supabase
      .from('artifacts')
      .update({ images: [...(art.images || []), ...newUrls] })
      .eq('id', art.id);
    if (updateErr) {
      errors.push({ slug, reason: `DB update failed: ${updateErr.message}` });
    }
  }

  // Mark state submitted
  const state = loadState() || {};
  state.phase = 'submitted';
  saveState(state);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, created, uploaded, skipped, errors }));
  setTimeout(() => server.close(() => process.exit(0)), 150);
}

// ── Browser HTML ─────────────────────────────────────────────────────
function buildHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Artifact Ingest</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f0eb;color:#333;padding:24px}
  h1{font-size:22px;margin-bottom:4px}
  .subtitle{color:#888;font-size:13px;margin-bottom:24px}
  .section-title{font-size:17px;font-weight:600;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #ddd}
  .artifact-group{margin-bottom:28px}
  .artifact-group h3{font-size:14px;font-weight:600;color:#555;margin-bottom:8px}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
  .card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .card img{width:100%;height:180px;object-fit:cover;display:block;background:#eee}
  .card-body{padding:10px}
  .card-filename{font-size:11px;color:#aaa;font-family:monospace;margin-bottom:3px}
  .card-reasoning{font-size:12px;color:#777;margin-bottom:7px;line-height:1.4}
  .badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700}
  .hi{background:#d4edda;color:#155724}.mid{background:#fff3cd;color:#856404}.lo{background:#f8d7da;color:#721c24}
  .card-controls{display:flex;gap:6px;align-items:center}
  .card-controls select{flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px}
  .card-controls input[type=checkbox]{width:16px;height:16px;cursor:pointer}
  /* New artifact cards */
  .proposal-card{background:#fff;border-radius:10px;border:2px solid #e5e7eb;padding:16px;margin-bottom:20px;transition:opacity .2s}
  .proposal-card.skipped{opacity:.45}
  .proposal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .proposal-header h3{font-size:14px;font-weight:600;color:#444}
  .skip-toggle{display:flex;align-items:center;gap:5px;font-size:12px;color:#888;cursor:pointer}
  .skip-toggle input{cursor:pointer}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
  .field-row.full{grid-template-columns:1fr}
  .field label{display:block;font-size:11px;font-weight:600;color:#888;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px}
  .field input,.field select,.field textarea{width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:5px;font-size:13px;font-family:inherit}
  .field textarea{resize:vertical;min-height:64px}
  .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:#6366f1}
  .slug-note{font-size:10px;color:#aaa;margin-top:2px}
  .photo-strip{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0}
  .photo-thumb{position:relative;width:110px;height:110px;border-radius:5px;overflow:hidden;flex-shrink:0}
  .photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .photo-thumb .remove-btn{position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
  .photo-strip .no-photos{font-size:12px;color:#bbb;padding:6px 0}
  /* Unassigned pool */
  .pool-section{margin-top:24px}
  .pool-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:10px}
  .pool-card{background:#fff;border-radius:7px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.1)}
  .pool-card img{width:100%;height:120px;object-fit:cover;display:block}
  .pool-card-body{padding:8px}
  .pool-card-body select{width:100%;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:12px;margin-top:4px}
  .pool-card-body .pool-fn{font-size:10px;color:#bbb;font-family:monospace}
  /* Submit bar */
  .submit-bar{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:14px 24px;box-shadow:0 -2px 8px rgba(0,0,0,.1);display:flex;justify-content:space-between;align-items:center;z-index:10}
  .submit-bar button{background:#f97316;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer}
  .submit-bar button:hover{background:#ea6c0a}
  .submit-bar button:disabled{background:#ccc;cursor:not-allowed}
  .submit-info{font-size:13px;color:#888}
  .content{padding-bottom:76px}
  .loading{text-align:center;padding:48px;color:#aaa}
  .success{text-align:center;padding:56px;max-width:480px;margin:0 auto}
  .success h2{font-size:22px;margin-bottom:8px}
  .success p{color:#666;margin-top:6px;font-size:14px}
  .errors-panel{background:#fff3f3;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-top:16px;font-size:12px}
  .errors-panel summary{cursor:pointer;font-weight:600;color:#b91c1c}
</style>
</head>
<body>
<div class="content" id="app"><div class="loading">Analyzing photos with Claude vision…</div></div>
<div class="submit-bar">
  <span class="submit-info" id="submit-info"></span>
  <button id="submit-btn" disabled onclick="submitAll()">Publish All</button>
</div>
<script>
const CATEGORIES=${JSON.stringify(CATEGORIES)};
let state={classified:[],proposals:[]};
let artifacts=[];
let unassignedPool=[];  // {filename}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function badgeClass(c){return c>0.8?'hi':c>=0.5?'mid':'lo'}
function artifactOpts(sel){
  return '<option value="">— dismiss —</option>'+artifacts.map(a=>
    '<option value="'+esc(a.slug)+'"'+(a.slug===sel?' selected':'')+'>'+esc(a.title)+'</option>'
  ).join('');
}
function catOpts(sel){
  return CATEGORIES.map(c=>'<option value="'+esc(c)+'"'+(c===sel?' selected':'')+'>'+esc(c)+'</option>').join('');
}

async function init(){
  try{
    const [stateRes,artRes]=await Promise.all([
      fetch('/state').then(r=>r.json()),
      fetch('/artifacts').then(r=>r.json()),
    ]);
    state=stateRes;
    artifacts=artRes;
    // Init unassigned pool: photos with slug=null not in any proposal
    const assignedFiles=new Set((state.proposals||[]).flatMap(p=>p.photos||[]));
    unassignedPool=(state.classified||[])
      .filter(c=>c.slug===null&&!assignedFiles.has(c.filename))
      .map(c=>c.filename);
    render();
  }catch(e){
    document.getElementById('app').innerHTML='<p style="color:red">Failed to load: '+esc(e.message)+'</p>';
  }
}

function render(){
  const matched=(state.classified||[]).filter(c=>c.slug!==null);
  const proposals=state.proposals||[];

  // Group matched by slug
  const groups={};
  for(const c of matched){if(!groups[c.slug])groups[c.slug]=[];groups[c.slug].push(c);}

  let html='<h1>Artifact Ingest</h1>';
  const mCount=matched.length;
  const pCount=proposals.length;
  html+='<p class="subtitle">'+(state.classified||[]).length+' photos analyzed · '+mCount+' matched to existing · '+pCount+' new artifact'+(pCount!==1?'s':'')+' proposed</p>';

  if(mCount>0){
    html+='<div class="section-title">Matched Photos</div>';
    for(const slug of Object.keys(groups).sort()){
      const art=artifacts.find(a=>a.slug===slug);
      html+='<div class="artifact-group"><h3>'+(art?esc(art.title):esc(slug))+'</h3><div class="cards">';
      for(const c of groups[slug]) html+=matchedCardHTML(c);
      html+='</div></div>';
    }
  }

  if(proposals.length>0){
    html+='<div class="section-title">New Artifacts</div>';
    for(const p of proposals) html+=proposalCardHTML(p);
  }

  html+=poolHTML();
  document.getElementById('app').innerHTML=html;
  updateSubmitBar();
}

function matchedCardHTML(c){
  const autoCheck=c.slug&&c.confidence>0.8?' checked':'';
  return '<div class="card">'+
    '<img src="/photos/'+encodeURIComponent(c.filename)+'" loading="lazy">'+
    '<div class="card-body">'+
      '<div class="card-filename">'+esc(c.filename)+' <span class="badge '+badgeClass(c.confidence)+'">'+Math.round(c.confidence*100)+'%</span></div>'+
      '<div class="card-reasoning">'+esc(c.reasoning||'')+'</div>'+
      '<div class="card-controls">'+
        '<select data-mfile="'+esc(c.filename)+'" onchange="updateSubmitBar()">'+artifactOpts(c.slug)+'</select>'+
        '<input type="checkbox" data-mfile="'+esc(c.filename)+'"'+autoCheck+' onchange="updateSubmitBar()">'+
      '</div>'+
    '</div></div>';
}

function proposalCardHTML(p){
  const thumbs=p.photos.map(f=>
    '<div class="photo-thumb">'+
      '<img src="/photos/'+encodeURIComponent(f)+'" loading="lazy">'+
      '<button class="remove-btn" onclick="removePhoto('+JSON.stringify(p.id)+','+JSON.stringify(f)+')" title="Remove">×</button>'+
    '</div>'
  ).join('');
  return '<div class="proposal-card" id="prop-'+esc(p.id)+'">'+
    '<div class="proposal-header">'+
      '<h3>'+esc(p.title||'Untitled')+'</h3>'+
      '<label class="skip-toggle"><input type="checkbox" data-skip="'+esc(p.id)+'" onchange="toggleSkip('+JSON.stringify(p.id)+')"> Not an artifact</label>'+
    '</div>'+
    '<div class="field-row">'+
      '<div class="field"><label>Title *</label><input type="text" data-prop="'+esc(p.id)+'" data-field="title" value="'+esc(p.title||'')+'" oninput="autoSlug('+JSON.stringify(p.id)+')"></div>'+
      '<div class="field"><label>Category *</label><select data-prop="'+esc(p.id)+'" data-field="category">'+catOpts(p.category)+'</select></div>'+
    '</div>'+
    '<div class="field-row">'+
      '<div class="field"><label>Family</label><input type="text" data-prop="'+esc(p.id)+'" data-field="family" value="'+esc(p.family||'')+'" placeholder="e.g. Walsh"></div>'+
      '<div class="field"><label>Est. Value</label><input type="text" data-prop="'+esc(p.id)+'" data-field="estimated_value" value="'+esc(p.estimated_value||'')+'" placeholder="e.g. $50 – $80"></div>'+
    '</div>'+
    '<div class="field-row full"><div class="field"><label>Slug</label>'+
      '<input type="text" data-prop="'+esc(p.id)+'" data-field="slug" value="'+esc(p.slug||'')+'">'+
      '<div class="slug-note">Auto-derived from title. Override if needed.</div>'+
    '</div></div>'+
    '<div class="field-row full"><div class="field"><label>Description</label><textarea data-prop="'+esc(p.id)+'" data-field="description">'+esc(p.description||'')+'</textarea></div></div>'+
    '<div class="field-row full"><div class="field"><label>Provenance</label><input type="text" data-prop="'+esc(p.id)+'" data-field="provenance" value="'+esc(p.provenance||'')+'"></div></div>'+
    '<div class="photo-strip" id="strip-'+esc(p.id)+'">'+(thumbs||'<span class="no-photos">No photos</span>')+'</div>'+
  '</div>';
}

function poolHTML(){
  if(unassignedPool.length===0) return '';
  const cards=unassignedPool.map(f=>
    '<div class="pool-card">'+
      '<img src="/photos/'+encodeURIComponent(f)+'" loading="lazy">'+
      '<div class="pool-card-body">'+
        '<div class="pool-fn">'+esc(f)+'</div>'+
        '<select data-pool="'+esc(f)+'" onchange="updateSubmitBar()">'+artifactOpts('')+'</select>'+
      '</div>'+
    '</div>'
  ).join('');
  return '<div class="pool-section"><div class="section-title">Unassigned Photos</div><div class="pool-cards">'+cards+'</div></div>';
}

function autoSlug(propId){
  const titleEl=document.querySelector('[data-prop="'+propId+'"][data-field="title"]');
  const slugEl=document.querySelector('[data-prop="'+propId+'"][data-field="slug"]');
  if(titleEl&&slugEl){
    slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9\\s-]/g,'').trim().replace(/\\s+/g,'-').replace(/-+/g,'-');
  }
  updateSubmitBar();
}

function toggleSkip(propId){
  const card=document.getElementById('prop-'+propId);
  const cb=document.querySelector('[data-skip="'+propId+'"]');
  if(card&&cb) card.classList.toggle('skipped',cb.checked);
  updateSubmitBar();
}

function removePhoto(propId,filename){
  const strip=document.getElementById('strip-'+propId);
  if(!strip) return;
  const thumb=strip.querySelector('[data-thumb="'+filename+'"]');
  // Find and remove the thumb div
  const thumbs=strip.querySelectorAll('.photo-thumb');
  thumbs.forEach(el=>{
    const img=el.querySelector('img');
    if(img&&decodeURIComponent(img.src.split('/photos/')[1]||'')===filename){
      el.remove();
    }
  });
  if(strip.querySelectorAll('.photo-thumb').length===0){
    strip.innerHTML='<span class="no-photos">No photos</span>';
  }
  // Add to unassigned pool
  if(!unassignedPool.includes(filename)) unassignedPool.push(filename);
  const poolSection=document.querySelector('.pool-section');
  const anchor=document.querySelector('.submit-bar');
  const poolEl=document.createElement('div');
  poolEl.innerHTML=poolHTML();
  if(poolSection){poolSection.outerHTML=poolEl.innerHTML;}
  else{
    const content=document.getElementById('app');
    const existing=content.querySelector('.pool-section');
    if(existing) existing.outerHTML=poolEl.innerHTML;
    else content.insertAdjacentHTML('beforeend',poolHTML());
  }
  updateSubmitBar();
}

function updateSubmitBar(){
  let matchCount=0;
  document.querySelectorAll('input[type=checkbox][data-mfile]').forEach(cb=>{
    const sel=document.querySelector('select[data-mfile="'+cb.dataset.mfile+'"]');
    if(cb.checked&&sel&&sel.value) matchCount++;
  });
  const skipIds=new Set();
  document.querySelectorAll('input[data-skip]').forEach(cb=>{
    if(cb.checked) skipIds.add(cb.dataset.skip);
  });
  const propIds=new Set([...(state.proposals||[]).map(p=>p.id)]);
  const newCount=[...propIds].filter(id=>!skipIds.has(id)).length;
  let poolCount=0;
  document.querySelectorAll('select[data-pool]').forEach(sel=>{if(sel.value) poolCount++;});
  const total=matchCount+newCount+poolCount;
  document.getElementById('submit-info').textContent=
    total===0?'Nothing selected yet':(matchCount?matchCount+' matched':'')+(newCount?' · '+newCount+' new artifact'+(newCount!==1?'s':''):'')+(poolCount?' · '+poolCount+' unassigned':'');
  document.getElementById('submit-btn').disabled=total===0;
}

async function submitAll(){
  const btn=document.getElementById('submit-btn');
  btn.disabled=true; btn.textContent='Publishing…';

  // Build matched
  const matched={};
  document.querySelectorAll('input[type=checkbox][data-mfile]').forEach(cb=>{
    const sel=document.querySelector('select[data-mfile="'+cb.dataset.mfile+'"]');
    if(cb.checked&&sel&&sel.value){
      if(!matched[sel.value]) matched[sel.value]=[];
      matched[sel.value].push(cb.dataset.mfile);
    }
  });

  // Build newArtifacts from proposal cards
  const newArtifacts=[];
  const skipIds=new Set();
  document.querySelectorAll('input[data-skip]').forEach(cb=>{if(cb.checked) skipIds.add(cb.dataset.skip);});
  for(const p of (state.proposals||[])){
    if(skipIds.has(p.id)) continue;
    const g=f=>document.querySelector('[data-prop="'+p.id+'"][data-field="'+f+'"]')?.value||'';
    const strip=document.getElementById('strip-'+p.id);
    const photos=[...strip.querySelectorAll('.photo-thumb img')]
      .map(img=>decodeURIComponent(img.src.split('/photos/')[1]||''))
      .filter(Boolean);
    const title=g('title').trim();
    const slug=g('slug').trim();
    if(!title||!slug) continue;
    newArtifacts.push({id:p.id,title,slug,category:g('category'),family:g('family'),estimated_value:g('estimated_value'),description:g('description'),provenance:g('provenance'),photos});
  }

  // Pool assignments → add to matched
  document.querySelectorAll('select[data-pool]').forEach(sel=>{
    if(sel.value){
      if(!matched[sel.value]) matched[sel.value]=[];
      matched[sel.value].push(sel.dataset.pool);
    }
  });

  try{
    const res=await fetch('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matched,newArtifacts})});
    const data=await res.json();
    if(res.status===409&&data.conflicts){
      alert('Slug conflict: '+data.conflicts.join(', ')+'\\nRename those slugs and try again.');
      btn.disabled=false; btn.textContent='Publish All'; return;
    }
    if(!data.ok){
      alert('Error: '+data.error);
      btn.disabled=false; btn.textContent='Publish All'; return;
    }
    let successHTML='<div class="success"><h2>Published!</h2>'+
      '<p>'+data.created+' new artifact'+(data.created!==1?'s':'')+' created</p>'+
      '<p>'+data.uploaded+' photo'+(data.uploaded!==1?'s':'')+' uploaded</p>';
    if(data.skipped) successHTML+='<p>'+data.skipped+' already uploaded, skipped</p>';
    if(data.errors&&data.errors.length>0){
      successHTML+='<details class="errors-panel"><summary>'+data.errors.length+' error(s)</summary><ul>'+
        data.errors.map(e=>'<li>'+esc(e.filename||e.slug||'?')+': '+esc(e.reason)+'</li>').join('')+
      '</ul></details>';
    }
    successHTML+='<p style="margin-top:16px;color:#aaa">Run <code>npm run ingest</code> again to process more photos.</p></div>';
    document.getElementById('app').innerHTML=successHTML;
    document.querySelector('.submit-bar').style.display='none';
  }catch(e){
    alert('Network error: '+e.message);
    btn.disabled=false; btn.textContent='Publish All';
  }
}

init();
</script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  // Check photo directory
  if (!existsSync(PHOTO_DIR)) {
    console.error(`Photo directory not found: ${PHOTO_DIR}`);
    console.error('Download photos first:\n  mkdir -p tmp/artifact-photos\n  rclone copy icloud:<path> tmp/artifact-photos/ --progress');
    process.exit(1);
  }

  const allFiles = readdirSync(PHOTO_DIR)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  if (allFiles.length === 0) {
    console.error(`No image files found in ${PHOTO_DIR}`);
    process.exit(1);
  }

  // Load or init state
  let state = loadState();

  if (state?.phase === 'submitted') {
    console.log('Previous session already published. Delete tmp/ingest-state.json to start over.');
    process.exit(0);
  }

  if (state?.phase !== 'ready') {
    // Need to run vision passes
    if (!state) {
      state = { phase: 'analyzing', classified: [], proposals: [] };
      saveState(state);
    }

    console.log(`Found ${allFiles.length} image files`);

    // Fetch existing artifacts
    const { data: artifacts, error: fetchErr } = await supabase
      .from('artifacts')
      .select('slug, title, category, description, provenance');
    if (fetchErr || !artifacts) {
      console.error('Failed to fetch artifacts:', fetchErr?.message || 'no data');
      process.exit(1);
    }
    console.log(`Loaded ${artifacts.length} existing artifacts from Supabase`);

    await runClassifyPass(allFiles, artifacts, state);
    await runProposePass(state);

    state.phase = 'ready';
    saveState(state);

    const matched = (state.classified || []).filter((c) => c.slug !== null).length;
    const unmatched = (state.classified || []).filter((c) => c.slug === null).length;
    console.log(`\n── Analysis complete ──`);
    console.log(`Matched to existing: ${matched}`);
    console.log(`New proposals:       ${(state.proposals || []).length} artifact(s) from ${unmatched} unmatched photos`);
  } else {
    console.log('Using cached analysis. Delete tmp/ingest-state.json to re-run vision.');
  }

  // Start HTTP server
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildHTML());
      } else if (req.method === 'GET' && url.pathname === '/state') {
        serveState(res);
      } else if (req.method === 'GET' && url.pathname === '/artifacts') {
        await serveArtifacts(res);
      } else if (req.method === 'GET' && url.pathname.startsWith('/photos/')) {
        servePhoto(res, decodeURIComponent(url.pathname.slice('/photos/'.length)));
      } else if (req.method === 'POST' && url.pathname === '/submit') {
        await handleSubmit(req, res, server);
      } else {
        res.writeHead(404); res.end('Not found');
      }
    } catch (err) {
      console.error('Request error:', err);
      res.writeHead(500); res.end('Internal error');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Kill the previous ingest session:`);
      console.error(`  lsof -ti:${PORT} | xargs kill -9`);
      console.error('Then run npm run ingest again.');
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    const browserUrl = `http://localhost:${PORT}`;
    console.log(`\nReview UI → ${browserUrl}`);
    console.log('Press Ctrl+C to quit without publishing.\n');
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${cmd} ${browserUrl}`, () => {});
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
