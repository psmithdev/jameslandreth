/**
 * Add NEW documents to the archive from one-off source files.
 *
 * Sibling to fill-docs.mjs (which updates existing placeholder rows). This one
 * INSERTS new `documents` rows from curated metadata. PDFs are embedded as-is
 * (the viewer iframes them); Word docs are converted to HTML with their embedded
 * images inlined (textutil drops images) and the original kept as a download.
 *
 * Source files are read from tmp/new-docs/. Idempotent: upserts on slug.
 *
 * Usage:
 *   node scripts/add-docs.mjs --dry-run
 *   node scripts/add-docs.mjs
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = join(ROOT, '.env');
const SRC_DIR = join(ROOT, 'tmp', 'new-docs');
const BUCKET = 'documents';
const DRY_RUN = process.argv.includes('--dry-run');

const manifest = [
  {
    file: 'The-Little-Littlefield-Newsletter-rev.pdf',
    title: 'The Little Littlefield Newsletter',
    category: 'Family Newsletter',
    excerpt: 'A family newsletter from the Littlefields — news, milestones, and stories shared with relatives and friends.',
    tags: ['family', 'newsletter'],
    pages: '2 pages',
  },
  {
    file: 'christmas-letter-2016.pdf',
    title: 'Christmas Letter 2016',
    category: 'Family Newsletter',
    excerpt: "The family's 2016 Christmas letter, recounting the year's highlights and news.",
    date: 'December 2016',
    year: 2016,
    tags: ['Christmas', 'family'],
    pages: '5 pages',
  },
  {
    file: 'Christmas-greeting-2014-inside-whatever-is-beautiful.pdf',
    title: 'Christmas Greeting 2014',
    category: 'Family Newsletter',
    excerpt: "The 2014 Christmas greeting — 'whatever is beautiful' — sent to family and friends.",
    date: 'December 2014',
    year: 2014,
    tags: ['Christmas', 'family'],
    pages: '1 page',
  },
  {
    file: 'Jokes-I-often-tell.pdf',
    title: 'Jokes I Often Tell',
    category: 'Essay',
    excerpt: 'A well-worn collection of the jokes and one-liners Jim loves to tell.',
    tags: ['humor', 'family'],
    pages: '4 pages',
  },
  {
    file: 'APHORISMS-as-dictated-by-James-J-Walsh.pdf',
    title: 'Aphorisms as Dictated by James J. Walsh',
    category: 'Essay',
    excerpt: 'A collection of aphorisms and sayings dictated by James J. Walsh.',
    tags: ['aphorisms', 'wisdom'],
    pages: '8 pages',
  },
  {
    file: 'Story-Songs-edits-by-Mary-3-11-17.pdf',
    title: 'Story Songs',
    category: 'Essay',
    excerpt: "Reflections on the narrative songs that have told stories throughout Jim's life.",
    date: 'March 2017',
    year: 2017,
    tags: ['music', 'memoir'],
    pages: '6 pages',
  },
  {
    file: 'Harold-Francis-Littlefield.docx',
    title: 'Harold F. Littlefield: The Littlefield Who Won the War',
    category: 'Family',
    excerpt: "The story of Harold F. Littlefield and his part in the Battle of Midway — 'the Littlefield who won the war (literally), but not single-handedly.'",
    tags: ['family', 'history', 'WWII'],
  },
  {
    file: 'The-Lights-of-Betterton.docx',
    title: 'The Lights of Betterton',
    category: 'Essay',
    excerpt: 'A reflection on the lights of Betterton, opening with Fitzgerald and the recurring motif of light in The Great Gatsby.',
    tags: ['memoir', 'reflection', 'literature'],
  },
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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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
function textFor(file) {
  return execFileSync('textutil', ['-convert', 'txt', '-stdout', file], { encoding: 'utf8' });
}
function pageEstimate(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.ceil(words / 500));
  return `${pages} ${pages === 1 ? 'page' : 'pages'}`;
}
function mimeForImage(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.tiff' || ext === '.tif') return 'image/tiff';
  return 'image/jpeg';
}

function relsMap(docx) {
  const xml = unzipText(docx, 'word/_rels/document.xml.rels');
  const map = {};
  for (const m of xml.matchAll(/Id="(rId\d+)"[^>]*?Target="([^"]+)"/g)) {
    map[m[1]] = m[2].replace(/^\//, '');
  }
  return map;
}

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
        out.push(`<figure><img src="${publicUrl(storagePath)}" alt="${slug} photograph ${imgIndex}"></figure>`);
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

console.log(`${DRY_RUN ? 'Dry run:' : 'Adding'} ${manifest.length} document(s)\n`);

for (const item of manifest) {
  const src = join(SRC_DIR, item.file);
  if (!existsSync(src)) throw new Error(`Source not found: ${src}`);
  const ext = extname(src).toLowerCase();
  const slug = item.slug || slugify(item.title);
  const stats = statSync(src);
  const bytes = readFileSync(src);

  const row = {
    slug,
    title: item.title,
    category: item.category,
    excerpt: item.excerpt || null,
    date: item.date || null,
    year: item.year ?? null,
    location: item.location || null,
    tags: item.tags || [],
    pages: item.pages || null,
    status: 'published',
    featured: false,
    content_hash: createHash('sha256').update(bytes).digest('hex'),
  };

  let images = [];
  if (ext === '.doc' || ext === '.docx') {
    const built = buildHtml(src, slug);
    images = built.images;
    row.file_path = `previews/${slug}.html`;
    row.file_type = 'HTML';
    row.source_file_path = `originals/${slug}${ext}`;
    row.source_file_type = 'Word';
    row.source_file_size = stats.size;
    row.source_modified_at = stats.mtime.toISOString();
    row.pages = row.pages || pageEstimate(textFor(src));
    item._html = built.html;
  } else {
    // PDF (and other binary previewables): serve the file directly.
    row.file_path = `originals/${slug}${ext}`;
    row.file_type = ext === '.pdf' ? 'PDF' : item.category;
  }

  console.log(`- ${slug}  [${row.file_type}]  ${images.length ? images.length + ' img' : ''}`);

  if (DRY_RUN) continue;

  if (ext === '.doc' || ext === '.docx') {
    for (const img of images) {
      await upload(img.storagePath, unzipBytes(src, img.entry), img.contentType);
    }
    await upload(row.file_path, new Blob([item._html], { type: 'text/html; charset=utf-8' }), 'text/html; charset=utf-8');
    await upload(row.source_file_path, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  } else {
    await upload(row.file_path, bytes, ext === '.pdf' ? 'application/pdf' : 'application/octet-stream');
  }

  const { error } = await supabase.from('documents').upsert(row, { onConflict: 'slug' });
  if (error) throw new Error(`Upsert failed for ${slug}: ${error.message}`);
  console.log(`    added ✓`);
}

console.log('\nDone.');
