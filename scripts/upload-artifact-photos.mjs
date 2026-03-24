import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, basename, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ── Config ──────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = join(ROOT, 'tmp', 'artifact-photos');
const MAP_FILE = join(ROOT, 'scripts', 'artifact-photo-map.json');
const ENV_FILE = join(ROOT, '.env');

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 85;
const BUCKET = 'artifacts';

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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// ── Supabase client (service role — bypasses RLS) ───────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────
function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const HEIC_EXTS = new Set(['.heic', '.heif']);

async function processImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  let pipeline = sharp(filePath);

  // HEIC/HEIF → JPEG
  if (HEIC_EXTS.has(ext)) {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY });
  }

  // Resize (preserve aspect ratio, only shrink)
  pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });

  // For non-HEIC, re-encode as JPEG for consistent output
  if (!HEIC_EXTS.has(ext)) {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY });
  }

  const buffer = await pipeline.toBuffer();
  return { buffer, outputExt: 'jpg', contentType: 'image/jpeg' };
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  // Validate paths
  if (!existsSync(MAP_FILE)) {
    console.error(`Mapping file not found: ${MAP_FILE}`);
    console.error('Create it with artifact slugs → filename arrays.');
    process.exit(1);
  }
  if (!existsSync(PHOTO_DIR)) {
    console.error(`Photo directory not found: ${PHOTO_DIR}`);
    console.error('Download photos first: mkdir -p tmp/artifact-photos && rclone copy ...');
    process.exit(1);
  }

  const mapping = JSON.parse(readFileSync(MAP_FILE, 'utf-8'));
  const slugs = Object.keys(mapping);
  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const slug of slugs) {
    const filenames = mapping[slug];
    if (!filenames || filenames.length === 0) {
      console.log(`⏭  ${slug}: no photos mapped, skipping`);
      continue;
    }

    // Look up artifact by slug
    const { data: artifact, error: fetchErr } = await supabase
      .from('artifacts')
      .select('id, slug, images')
      .eq('slug', slug)
      .single();

    if (fetchErr || !artifact) {
      console.error(`✗  ${slug}: artifact not found in DB — ${fetchErr?.message || 'no data'}`);
      totalErrors += filenames.length;
      continue;
    }

    const existingImages = artifact.images || [];
    const newUrls = [];

    for (const filename of filenames) {
      const filePath = join(PHOTO_DIR, filename);
      if (!existsSync(filePath)) {
        console.error(`  ✗  ${filename}: file not found at ${filePath}`);
        totalErrors++;
        continue;
      }

      // Check for duplicate (same base name already uploaded for this slug)
      const baseName = sanitizeName(basename(filename, extname(filename)));
      const alreadyUploaded = existingImages.some((url) => url.includes(`/${slug}/${baseName}-`));
      if (alreadyUploaded) {
        console.log(`  ⏭  ${filename}: already uploaded for ${slug}, skipping`);
        totalSkipped++;
        continue;
      }

      try {
        // Process image (resize + convert)
        const { buffer, outputExt, contentType } = await processImage(filePath);
        const storageName = `${baseName}-${Date.now()}.${outputExt}`;
        const storagePath = `${slug}/${storageName}`;

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, { contentType, upsert: false });

        if (uploadErr) {
          console.error(`  ✗  ${filename}: upload failed — ${uploadErr.message}`);
          totalErrors++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        newUrls.push(urlData.publicUrl);
        console.log(`  ✓  ${filename} → ${storagePath}`);
        totalUploaded++;
      } catch (err) {
        console.error(`  ✗  ${filename}: processing failed — ${err.message}`);
        totalErrors++;
      }
    }

    if (newUrls.length > 0) {
      // Append new URLs to existing images array
      const { error: updateErr } = await supabase
        .from('artifacts')
        .update({ images: [...existingImages, ...newUrls] })
        .eq('id', artifact.id);

      if (updateErr) {
        console.error(`✗  ${slug}: DB update failed — ${updateErr.message}`);
        totalErrors += newUrls.length;
      } else {
        console.log(`✓  ${slug}: ${newUrls.length} image(s) added (${existingImages.length + newUrls.length} total)`);
      }
    }
  }

  console.log('\n── Summary ──');
  console.log(`Uploaded: ${totalUploaded}`);
  console.log(`Skipped:  ${totalSkipped}`);
  console.log(`Errors:   ${totalErrors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
