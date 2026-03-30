/**
 * propose-artifacts.mjs
 *
 * Two-phase script to create new artifact records from unmatched photos.
 *
 * Phase 1 (default): Sends unmatched photos to Claude vision. Claude groups
 *   them by object and drafts a complete artifact record for each group.
 *   Output → tmp/artifact-proposals.json
 *
 * Phase 2 (--apply): Reads tmp/artifact-proposals.json, filters to entries
 *   marked approved:true, and inserts them into Supabase. Then prints a
 *   reminder to re-run classify-photos so these new artifacts get matched.
 *
 * Usage:
 *   npm run propose-artifacts             # Phase 1 — analyze
 *   npm run propose-artifacts -- --apply  # Phase 2 — insert into Supabase
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

// ── Config ──────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = join(ROOT, 'tmp', 'artifact-photos');
const PROPOSALS_FILE = join(ROOT, 'tmp', 'photo-proposals.json');
const ARTIFACT_PROPOSALS_FILE = join(ROOT, 'tmp', 'artifact-proposals.json');
const ENV_FILE = join(ROOT, '.env');

const THUMB_WIDTH = 512;
// Max photos to send in one Claude call — lamps are likely 1 category so
// send all unmatched at once (up to 20); split into groups of 20 if more.
const BATCH_SIZE = 20;

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
async function createThumbnail(filePath) {
  const buffer = await sharp(filePath)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buffer.toString('base64');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Phase 1: Analyze ─────────────────────────────────────────────────
async function analyzeUnmatched(unmatchedFiles) {
  const allProposals = [];

  for (let i = 0; i < unmatchedFiles.length; i += BATCH_SIZE) {
    const batch = unmatchedFiles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(unmatchedFiles.length / BATCH_SIZE);
    console.log(`\nAnalyzing batch ${batchNum}/${totalBatches} (${batch.length} photos)...`);

    const content = [];

    // Build the prompt
    content.push({
      type: 'text',
      text: `You are building a family heirloom catalog. These photos may show one or several distinct physical objects.

Your task:
1. Look at all photos carefully.
2. Group photos that show the **same physical object** (same item from different angles, or multiple identical items in a set).
3. For each distinct object or set, draft a complete artifact record.

Return ONLY a JSON array. Each element:
{
  "title": "concise descriptive name (e.g. 'Kerosene Hurricane Lamp', 'Pair of Brass Candlesticks')",
  "slug": "url-safe kebab-case (e.g. 'kerosene-hurricane-lamp')",
  "category": "single word or short phrase (e.g. 'Lighting', 'Furniture', 'Textiles', 'Ceramics', 'Glassware', 'Metalware', 'Books', 'Art')",
  "description": "2–3 sentences: what it is, approximate era/style, materials, notable details visible in the photos",
  "provenance": "any origin clues visible (maker's marks, labels, style period) — or null if unknown",
  "photos": ["filename1.jpg", "filename2.jpg"]
}

Photo index starts at 0. Each photo is labeled below.`,
    });

    // Add thumbnails
    const validFiles = [];
    for (let j = 0; j < batch.length; j++) {
      const filename = batch[j];
      try {
        const base64 = await createThumbnail(join(PHOTO_DIR, filename));
        content.push({ type: 'text', text: `\nPhoto ${validFiles.length}: ${filename}` });
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
        });
        validFiles.push(filename);
      } catch (err) {
        console.warn(`  ⚠  ${filename}: thumbnail failed (${err.message}), skipping`);
      }
    }

    if (validFiles.length === 0) {
      console.warn('  No valid photos in batch, skipping.');
      continue;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`  ✗  No JSON array in response: ${text.slice(0, 300)}`);
      continue;
    }

    let batchProposals;
    try {
      batchProposals = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error(`  ✗  JSON parse failed: ${err.message}`);
      continue;
    }

    // Normalize: ensure slug and approved fields
    for (const p of batchProposals) {
      p.slug = p.slug || slugify(p.title || 'unknown-artifact');
      p.approved = false; // user must explicitly approve
      allProposals.push(p);
      console.log(`  ✓  "${p.title}" (${p.photos?.length ?? 0} photos) — slug: ${p.slug}`);
    }

    if (i + BATCH_SIZE < unmatchedFiles.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return allProposals;
}

// ── Phase 2: Apply ───────────────────────────────────────────────────
async function applyProposals() {
  if (!existsSync(ARTIFACT_PROPOSALS_FILE)) {
    console.error(`No proposals file at ${ARTIFACT_PROPOSALS_FILE}`);
    console.error('Run phase 1 first: npm run propose-artifacts');
    process.exit(1);
  }

  const proposals = JSON.parse(readFileSync(ARTIFACT_PROPOSALS_FILE, 'utf-8'));
  const approved = proposals.filter((p) => p.approved === true);

  if (approved.length === 0) {
    console.log('No proposals marked approved:true in artifact-proposals.json.');
    console.log('Edit the file, set "approved": true on each record you want to insert, then re-run.');
    process.exit(0);
  }

  // Check for slug conflicts with existing artifacts
  const { data: existing, error: fetchErr } = await supabase
    .from('artifacts')
    .select('slug');

  if (fetchErr) {
    console.error('Failed to fetch existing artifacts:', fetchErr.message);
    process.exit(1);
  }

  const existingSlugs = new Set(existing.map((a) => a.slug));
  let inserted = 0;
  let skipped = 0;

  for (const p of approved) {
    if (existingSlugs.has(p.slug)) {
      console.log(`  ⚠  Skipping "${p.title}" — slug "${p.slug}" already exists`);
      skipped++;
      continue;
    }

    const record = {
      slug: p.slug,
      title: p.title,
      category: p.category || 'Uncategorized',
      description: p.description || null,
      provenance: p.provenance || null,
      status: 'available',
      images: [],
    };

    const { error: insertErr } = await supabase.from('artifacts').insert(record);

    if (insertErr) {
      console.error(`  ✗  Failed to insert "${p.title}": ${insertErr.message}`);
    } else {
      console.log(`  ✓  Inserted "${p.title}" (${p.slug})`);
      inserted++;
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped:  ${skipped} (slug conflict)`);

  if (inserted > 0) {
    console.log('\nNext steps:');
    console.log('  1. Delete tmp/photo-proposals.json to force a fresh classify run');
    console.log('  2. npm run classify-photos  — match photos to new artifact records');
    console.log('  3. npm run review-photos    — confirm matches');
    console.log('  4. npm run upload-photos    — push to Supabase Storage');
  }
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const applyMode = process.argv.includes('--apply');

  if (applyMode) {
    console.log('── Phase 2: Apply approved proposals to Supabase ──');
    await applyProposals();
    return;
  }

  // Phase 1: analyze
  console.log('── Phase 1: Analyze unmatched photos ──');

  if (!existsSync(PROPOSALS_FILE)) {
    console.error(`No classify output at ${PROPOSALS_FILE}`);
    console.error('Run first: npm run classify-photos');
    process.exit(1);
  }

  const classify = JSON.parse(readFileSync(PROPOSALS_FILE, 'utf-8'));
  const unmatched = (classify.proposals || []).filter((p) => p.slug === null);

  if (unmatched.length === 0) {
    console.log('No unmatched photos found in photo-proposals.json. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${unmatched.length} unmatched photos`);

  // Verify all files exist
  const unmatchedFiles = unmatched
    .map((p) => p.filename)
    .filter((f) => existsSync(join(PHOTO_DIR, f)));

  const missing = unmatched.length - unmatchedFiles.length;
  if (missing > 0) {
    console.warn(`⚠  ${missing} unmatched files not found on disk — they'll be skipped`);
  }

  const proposals = await analyzeUnmatched(unmatchedFiles);

  if (proposals.length === 0) {
    console.error('No proposals generated. Check API key and photo files.');
    process.exit(1);
  }

  writeFileSync(ARTIFACT_PROPOSALS_FILE, JSON.stringify(proposals, null, 2) + '\n');

  console.log('\n── Summary ──');
  console.log(`Proposed ${proposals.length} new artifact record(s)`);
  console.log(`\nNext steps:`);
  console.log(`  1. Open tmp/artifact-proposals.json`);
  console.log(`  2. Review each entry — edit title/slug/description as needed`);
  console.log(`  3. Set "approved": true on each record you want to create`);
  console.log(`  4. npm run propose-artifacts -- --apply`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
