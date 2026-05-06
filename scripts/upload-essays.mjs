/**
 * Upload the LIT-15 essay batch to the public document archive.
 *
 * The source folder has 24 files. This manifest intentionally publishes 20:
 * - keeps the revised Edna Swanson story over the earlier duplicate
 * - keeps one copy of "Life is not a problem..."
 * - excludes the Joyce dissertation excerpt
 * - excludes the Pierre ornament note, which is artifact-oriented
 *
 * Usage:
 *   node scripts/upload-essays.mjs --dry-run
 *   node scripts/upload-essays.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const ESSAY_DIR = join(ROOT, 'essays');
const TMP_DIR = join(ROOT, 'tmp', 'essay-html');
const ENV_FILE = join(ROOT, '.env');
const BUCKET = 'documents';
const DRY_RUN = process.argv.includes('--dry-run');

const manifest = [
  { file: 'After the fall.docx', title: 'After the Fall, or Herpetology 101', tags: ['poem', 'family'] },
  { file: 'Banana Bread article for GoB revised.docx', title: 'Banana Bread (Bananakaka)', tags: ['family', 'food', 'Sweden'] },
  { file: 'Edna Swanson revised wig story double with gull.docx', title: 'Edna Swanson and the Wig', date: 'February 4, 2020', year: 2020, tags: ['family', 'memoir'] },
  { file: 'Ether - revised.docx', title: 'Ether', date: 'October 17, 2019', year: 2019, tags: ['medicine', 'memoir'] },
  { file: 'Flying down to Rio without Fred or Ginger.docx', title: 'Flying Down to Rio Without Fred or Ginger', tags: ['travel', 'medicine'] },
  { file: 'In the shop.docx', title: 'In the Shop', tags: ['memoir', 'work'] },
  { file: 'It was Thursday.docx', title: 'It Was Thursday', tags: ['nonfiction'] },
  { file: 'Life is not a problem to be solved but a mystery to be lived.doc', title: 'Life Is Not a Problem to Be Solved but a Mystery to Be Lived', tags: ['reflection'] },
  { file: 'Lunch at Marshall Fields.docx', title: 'Lunch at Marshall Field\'s', tags: ['memoir', 'Chicago'] },
  { file: 'My Writing Class 2 revised.docx', title: 'My Writing Class', tags: ['writing', 'memoir'] },
  { file: 'Physics is important Qunatum Mechanics and Reality.docx', title: 'Physics Is Important: Quantum Mechanics and Reality', tags: ['science', 'books'] },
  { file: 'Rhine Getaway.docx', title: 'Viking Rhine Getaway', date: 'June 7, 2023', year: 2023, location: 'Rhine River', tags: ['travel', 'Europe'] },
  { file: 'Ringling Bros Circus Closing after 146 years rev.docx', title: 'Ringling Bros. Circus Closing After 146 Years', tags: ['circus', 'reflection'] },
  { file: 'Scotland the Brave James L.docx', title: 'Scotland the Brave', tags: ['travel', 'Scotland'] },
  { file: 'Some thoughts on Ireland.docx', title: 'Some Thoughts on Ireland', tags: ['travel', 'Ireland'] },
  { file: 'Songs in my life expanded.docx', title: 'Songs in My Life', tags: ['music', 'memoir'] },
  { file: 'The French Lesson.docx', title: 'The French Lesson', tags: ['language', 'memoir'] },
  { file: 'The Old Switcheroo.docx', title: 'The Old Switcheroo', tags: ['Sweden', 'history'] },
  { file: 'Thinking God Knows What.docx', title: 'Thinking God Knows What: James Joyce and Trieste', tags: ['literature', 'James Joyce'] },
  { file: 'Valborg rev.docx', title: 'Valborg', tags: ['Sweden', 'traditions'] },
];

function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }

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

function slugify(title) {
  return title.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function textFor(filePath) {
  return execFileSync('textutil', ['-convert', 'txt', '-stdout', filePath], { encoding: 'utf8' })
    .replace(/\r/g, '\n')
    .replace(/\u2028/g, '\n');
}

function htmlFor(filePath, outputPath) {
  execFileSync('textutil', ['-convert', 'html', '-output', outputPath, filePath], { stdio: 'pipe' });
  return readFileSync(outputPath, 'utf8');
}

function excerptFrom(text, title) {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((block) => {
      const normalizedBlock = block.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (normalizedBlock === normalizedTitle) return false;
      if (/^james (l\.)? littlefield$/i.test(block)) return false;
      return block.length > 70;
    });
  const excerpt = blocks[0] || text.replace(/\s+/g, ' ').trim();
  return excerpt.length > 260 ? `${excerpt.slice(0, 257).trim()}...` : excerpt;
}

function pageEstimate(wordCount) {
  const pages = Math.max(1, Math.ceil(wordCount / 500));
  return `${pages} ${pages === 1 ? 'page' : 'pages'}`;
}

const env = loadEnv(ENV_FILE);
const { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

mkdirSync(TMP_DIR, { recursive: true });

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const records = [];

for (const item of manifest) {
  const sourcePath = join(ESSAY_DIR, item.file);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }

  const slug = slugify(item.title);
  const htmlPath = join(TMP_DIR, `${slug}.html`);
  const text = textFor(sourcePath);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const html = htmlFor(sourcePath, htmlPath);
  const filePath = `essays/${slug}.html`;

  records.push({
    sourcePath,
    html,
    row: {
      slug,
      title: item.title,
      category: 'Essay',
      excerpt: item.excerpt || excerptFrom(text, item.title),
      date: item.date || null,
      year: item.year || null,
      location: item.location || null,
      tags: item.tags,
      pages: pageEstimate(words),
      file_type: 'HTML',
      file_path: filePath,
      status: 'published',
      featured: false,
    },
  });
}

console.log(`${DRY_RUN ? 'Dry run:' : 'Uploading'} ${records.length} essays`);

for (const { sourcePath, html, row } of records) {
  console.log(`- ${row.slug} (${basename(sourcePath)} -> ${row.file_path})`);

  if (DRY_RUN) continue;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(row.file_path, new Blob([html], { type: 'text/html; charset=utf-8' }), {
      contentType: 'text/html; charset=utf-8',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed for ${row.file_path}: ${uploadError.message}`);
  }

  const { error: upsertError } = await supabase
    .from('documents')
    .upsert(row, { onConflict: 'slug' });

  if (upsertError) {
    throw new Error(`Upsert failed for ${row.slug}: ${upsertError.message}`);
  }
}

const excluded = [
  'From a dissertation on Joyce.docx',
  'Life is not a problem to be solved but a mystery to be lived(1).doc',
  'Mrs Edith Swanson and the wig story.docx',
  'balloon pierre ornament.docx',
];

console.log('\nExcluded files:');
for (const file of excluded) {
  console.log(`- ${file}`);
}

const unknownExts = records
  .map(({ sourcePath }) => extname(sourcePath).toLowerCase())
  .filter((ext) => !['.doc', '.docx'].includes(ext));
if (unknownExts.length > 0) {
  throw new Error(`Unexpected source extensions: ${unknownExts.join(', ')}`);
}
