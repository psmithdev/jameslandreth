/**
 * Convert PowerPoint decks into web slideshows and add them as documents.
 *
 * Pipeline per deck:
 *   1. soffice (LibreOffice) headless: .pptx/.ppt -> PDF
 *   2. pdftoppm (poppler): PDF -> web-sized JPEG, one per slide
 *   3. upload slides to Supabase storage:  slideshows/<slug>/slide-NNN.jpg
 *   4. write a slides.json manifest (list of public URLs) -> slideshows/<slug>/slides.json
 *   5. upload the original deck as the downloadable source
 *   6. upsert a documents row with file_type 'Slideshow' (the viewer renders a gallery)
 *
 * Conversion artifacts are cached under tmp/decks so re-runs are cheap.
 * Idempotent: upserts on slug.
 *
 * Requires: /Applications/LibreOffice.app + poppler (pdftoppm) on PATH.
 *
 * Usage:
 *   node scripts/add-slideshows.mjs --dry-run
 *   node scripts/add-slideshows.mjs --only costa-rica
 *   node scripts/add-slideshows.mjs
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = join(ROOT, '.env');
const DECK_DIR = join(ROOT, 'tmp', 'decks');
const PDF_DIR = join(DECK_DIR, 'pdf');
const IMG_DIR = join(DECK_DIR, 'img');
const SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
const BUCKET = 'documents';
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i === -1 ? null : process.argv[i + 1];
})();

const decks = [
  { file: 'Canadian Rocky Mountaineer.pptx', slug: 'canadian-rocky-mountaineer', title: 'Canadian Rocky Mountaineer', category: 'Travel', location: 'Canada', tags: ['travel', 'Canada', 'railway'], excerpt: 'A photo journey aboard the Rocky Mountaineer through the Canadian Rockies.' },
  { file: 'Lake District England.pptx', slug: 'lake-district-england', title: 'The Lake District, England', category: 'Travel', location: 'England', tags: ['travel', 'England'], excerpt: "Scenes from a trip through England's Lake District." },
  { file: 'West Virginia trip 2019 comp.pptx', slug: 'west-virginia-2019', title: 'West Virginia Trip 2019', category: 'Travel', location: 'West Virginia', year: 2019, date: '2019', tags: ['travel', 'West Virginia'], excerpt: 'A 2019 road trip through West Virginia.' },
  { file: 'Mediterranean Oddyssey.pptx', slug: 'mediterranean-odyssey', title: 'Mediterranean Odyssey', category: 'Travel', location: 'Mediterranean', tags: ['travel', 'Mediterranean', 'cruise'], excerpt: 'A cruise across the Mediterranean.' },
  { file: 'Costa Rrrrrrrica.ppt', slug: 'costa-rica', title: 'Costa Rica', category: 'Travel', location: 'Costa Rica', tags: ['travel', 'Costa Rica', 'wildlife'], excerpt: 'A trip through the wildlife and landscapes of Costa Rica.' },
];

function loadEnv(filePath) {
  const env = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv(ENV_FILE);
const { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

function publicUrl(path) {
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function toPdf(deckPath, slug) {
  const pdfPath = join(PDF_DIR, `${slug}.pdf`);
  if (existsSync(pdfPath)) return pdfPath;
  mkdirSync(PDF_DIR, { recursive: true });
  // Convert, then rename LibreOffice's output (named after the source basename).
  execFileSync(SOFFICE, [
    '-env:UserInstallation=file:///tmp/lo-slideshow-profile',
    '--headless', '--convert-to', 'pdf', '--outdir', PDF_DIR, deckPath,
  ], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
  const produced = join(PDF_DIR, extname(deckPath) === '.ppt'
    ? deckPath.split('/').pop().replace(/\.ppt$/i, '.pdf')
    : deckPath.split('/').pop().replace(/\.[^.]+$/, '.pdf'));
  if (produced !== pdfPath) execFileSync('mv', [produced, pdfPath]);
  return pdfPath;
}

function toSlides(pdfPath, slug) {
  const outDir = join(IMG_DIR, slug);
  if (existsSync(outDir) && readdirSync(outDir).some((f) => f.endsWith('.jpg'))) {
    return slideFiles(outDir);
  }
  mkdirSync(outDir, { recursive: true });
  execFileSync('pdftoppm', [
    '-jpeg', '-jpegopt', 'quality=82',
    '-scale-to-x', '1600', '-scale-to-y', '-1',
    pdfPath, join(outDir, 'slide'),
  ], { stdio: 'pipe' });
  return slideFiles(outDir);
}

function slideFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jpg'))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)/)?.[1] || 0);
      const nb = Number(b.match(/(\d+)/)?.[1] || 0);
      return na - nb;
    })
    .map((f) => join(dir, f));
}

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upload(path, body, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
}

const targets = decks.filter((d) => !ONLY || d.slug === ONLY);
console.log(`${DRY_RUN ? 'Dry run:' : 'Processing'} ${targets.length} slideshow(s)\n`);

for (const deck of targets) {
  const deckPath = join(DECK_DIR, deck.file);
  if (!existsSync(deckPath)) throw new Error(`Deck not found: ${deckPath}`);

  process.stdout.write(`- ${deck.slug}: converting… `);
  const pdfPath = toPdf(deckPath, deck.slug);
  const files = toSlides(pdfPath, deck.slug);
  console.log(`${files.length} slides`);

  if (DRY_RUN) continue;

  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const storagePath = `slideshows/${deck.slug}/slide-${String(i + 1).padStart(3, '0')}.jpg`;
    await upload(storagePath, readFileSync(files[i]), 'image/jpeg');
    urls.push(publicUrl(storagePath));
  }

  const manifestPath = `slideshows/${deck.slug}/slides.json`;
  await upload(manifestPath, new Blob([JSON.stringify({ slides: urls })], { type: 'application/json' }), 'application/json');

  const ext = extname(deckPath).toLowerCase();
  const sourcePath = `originals/${deck.slug}${ext}`;
  const deckBytes = readFileSync(deckPath);
  const stats = statSync(deckPath);
  await upload(sourcePath, deckBytes, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

  const { error } = await supabase.from('documents').upsert({
    slug: deck.slug,
    title: deck.title,
    category: deck.category,
    excerpt: deck.excerpt || null,
    date: deck.date || null,
    year: deck.year ?? null,
    location: deck.location || null,
    tags: deck.tags || [],
    pages: `${files.length} slides`,
    file_type: 'Slideshow',
    file_path: manifestPath,
    source_file_path: sourcePath,
    source_file_type: 'PowerPoint',
    source_file_size: stats.size,
    source_modified_at: stats.mtime.toISOString(),
    content_hash: createHash('sha256').update(deckBytes).digest('hex'),
    status: 'published',
    featured: false,
  }, { onConflict: 'slug' });
  if (error) throw new Error(`Upsert failed for ${deck.slug}: ${error.message}`);
  console.log(`    uploaded ${urls.length} slides + row ✓`);
}

console.log('\nDone.');
