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
