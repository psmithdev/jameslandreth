/**
 * Fill existing placeholder document rows with real, viewable content.
 *
 * Unlike sync-documents.mjs (which CREATES rows from the iCloud Website folder
 * with auto-generated slugs), this UPDATES existing `documents` rows in place by
 * slug — preserving their curated title, category, excerpt, and featured flag —
 * and only sets the file columns.
 *
 * Word docs are converted to HTML with their embedded images inlined. `textutil`
 * drops images, so image-heavy essays (e.g. the necktie photos in "If Ties Could
 * Talk") would otherwise lose their point. We parse word/document.xml directly to
 * place each image where it appears in the text. The original .docx is uploaded
 * as the downloadable source (source_file_path).
 *
 * Usage:
 *   node scripts/fill-docs.mjs --dry-run
 *   node scripts/fill-docs.mjs
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { statSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = join(ROOT, '.env');
const INCOMING = join(ROOT, 'tmp', 'incoming');
const BUCKET = 'documents';
const DRY_RUN = process.argv.includes('--dry-run');

// slug must match an EXISTING documents.slug. The row is updated in place.
const manifest = [
  { slug: 'all-s-quiet-on-the-mid-western-front', file: 'All_s quiet on the mid-western front christmas letter 22.docx' },
  { slug: 'ties-talk', file: 'If Ties Could Talk pt6.docx' },
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

function unzipText(docx, entry) {
  return execFileSync('unzip', ['-p', docx, entry], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function unzipBytes(docx, entry) {
  return execFileSync('unzip', ['-p', docx, entry], { maxBuffer: 256 * 1024 * 1024 });
}

function relsMap(docx) {
  const xml = unzipText(docx, 'word/_rels/document.xml.rels');
  const map = {};
  for (const m of xml.matchAll(/Id="(rId\d+)"[^>]*?Target="([^"]+)"/g)) {
    map[m[1]] = m[2].replace(/^\//, '');
  }
  return map;
}

function mimeForImage(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.tiff' || ext === '.tif') return 'image/tiff';
  return 'image/jpeg';
}

/**
 * Build HTML body from word/document.xml, inlining images at their positions.
 * Returns { html, images: [{ entry, storagePath, contentType }] }.
 */
function buildHtml(docx, slug) {
  const xml = unzipText(docx, 'word/document.xml');
  const rels = relsMap(docx);
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const paragraphs = [...body.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((m) => m[1]);

  const out = [];
  const images = [];
  let imgIndex = 0;

  for (const para of paragraphs) {
    const tokenRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>|r:embed="(rId\d+)"/g;
    let textBuf = '';
    let token;
    const flush = () => {
      const text = textBuf.replace(/\s+/g, ' ').trim();
      if (text) out.push(`<p>${text}</p>`);
      textBuf = '';
    };
    while ((token = tokenRe.exec(para))) {
      if (token[1] !== undefined) {
        textBuf += token[1];
      } else {
        flush();
        const target = rels[token[2]];
        if (!target) continue;
        imgIndex += 1;
        const ext = extname(target).toLowerCase();
        const storagePath = `previews/media/${slug}-${imgIndex}${ext}`;
        images.push({ entry: `word/${target}`, storagePath, contentType: mimeForImage(ext) });
        out.push(
          `<figure><img src="${publicUrl(storagePath)}" alt="${slug} photograph ${imgIndex}"></figure>`
        );
      }
    }
    flush();
  }

  const html = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n${out.join('\n')}\n</body>\n</html>\n`;
  return { html, images };
}

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upload(path, body, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
}

console.log(`${DRY_RUN ? 'Dry run:' : 'Filling'} ${manifest.length} document(s)\n`);

for (const item of manifest) {
  const docx = join(INCOMING, item.file);
  if (!existsSync(docx)) throw new Error(`Source not found: ${docx}`);

  const ext = extname(docx).toLowerCase();
  const { html, images } = buildHtml(docx, item.slug);
  const previewPath = `previews/${item.slug}.html`;
  const sourcePath = `originals/${item.slug}${ext}`;
  const bytes = readFileSync(docx);
  const stats = statSync(docx);

  console.log(`- ${item.slug}`);
  console.log(`    preview: ${previewPath}  (${images.length} image(s) inlined)`);
  console.log(`    source:  ${sourcePath}  (${(stats.size / 1024).toFixed(0)} KB)`);

  if (DRY_RUN) continue;

  for (const img of images) {
    await upload(img.storagePath, unzipBytes(docx, img.entry), img.contentType);
  }
  await upload(previewPath, new Blob([html], { type: 'text/html; charset=utf-8' }), 'text/html; charset=utf-8');
  await upload(
    sourcePath,
    bytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  const { error } = await supabase
    .from('documents')
    .update({
      file_path: previewPath,
      file_type: 'HTML',
      source_file_path: sourcePath,
      source_file_type: 'Word',
      source_file_size: stats.size,
      source_modified_at: stats.mtime.toISOString(),
      content_hash: createHash('sha256').update(bytes).digest('hex'),
    })
    .eq('slug', item.slug);

  if (error) throw new Error(`Update failed for ${item.slug}: ${error.message}`);
  console.log(`    updated row ✓`);
}

console.log('\nDone.');
