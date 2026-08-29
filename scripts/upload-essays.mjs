/**
 * Upload every Word document in the iCloud Essays folder to the public archive.
 *
 * Usage:
 *   node scripts/upload-essays.mjs --dry-run
 *   node scripts/upload-essays.mjs
 *   node scripts/upload-essays.mjs --source /path/to/Essays
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const sourceArg = sourceIndex === -1 ? null : args[sourceIndex + 1];
const ESSAY_DIR = resolve(
  sourceArg || join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Website', 'Essays')
);
const TMP_DIR = join(ROOT, 'tmp', 'essay-html');
const ENV_FILE = join(ROOT, '.env');
const BUCKET = 'documents';
const DRY_RUN = args.includes('--dry-run');

const manifest = [
  { file: 'essays/After the fall.docx', title: 'After the Fall, or Herpetology 101', tags: ['poem', 'family'] },
  { file: 'essays/balloon pierre ornament.docx', title: 'Pierre the Balloon Poodle', tags: ['humor', 'Scotland', 'language'] },
  { file: 'essays/Banana Bread article for GoB revised.docx', title: 'Banana Bread (Bananakaka)', tags: ['family', 'food', 'Sweden'] },
  { file: 'essays/Edna Swanson revised wig story double with gull.docx', title: 'Edna Swanson and the Wig', date: 'February 4, 2020', year: 2020, tags: ['family', 'memoir'] },
  { file: 'essays/Ether - revised.docx', title: 'Ether', date: 'October 17, 2019', year: 2019, tags: ['medicine', 'memoir'] },
  { file: 'essays/Flying down to Rio without Fred or Ginger.docx', title: 'Flying Down to Rio Without Fred or Ginger', tags: ['travel', 'medicine'] },
  { file: 'essays/From a dissertation on Joyce.docx', title: 'James Joyce and His Influences', tags: ['literature', 'James Joyce'] },
  { file: 'essays/In the shop.docx', title: 'In the Shop', tags: ['memoir', 'work'] },
  { file: 'essays/It was Thursday.docx', title: 'It Was Thursday', tags: ['nonfiction'] },
  { file: 'essays/Life is not a problem to be solved but a mystery to be lived.doc', title: 'Life Is Not a Problem to Be Solved but a Mystery to Be Lived', tags: ['reflection'] },
  { file: 'essays/Lunch at Marshall Fields.docx', title: 'Lunch at Marshall Field\'s', tags: ['memoir', 'Chicago'] },
  { file: 'essays/Mrs Edith Swanson and the wig story.docx', title: 'Mrs. Edith Swanson and the Wig', date: 'February 4, 2020', year: 2020, tags: ['family', 'memoir'] },
  { file: 'essays/My Writing Class  2 revised.docx', title: 'My Writing Class', tags: ['writing', 'memoir'] },
  { file: 'essays/Physics is important Qunatum Mechanics and Reality.docx', title: 'Physics Is Important: Quantum Mechanics and Reality', tags: ['science', 'books'] },
  { file: 'essays/Rhine Getaway.docx', title: 'Viking Rhine Getaway', date: 'June 7, 2023', year: 2023, location: 'Rhine River', tags: ['travel', 'Europe'] },
  { file: 'essays/Ringling Bros Circus Closing after 146 years rev.docx', title: 'Ringling Bros. Circus Closing After 146 Years', tags: ['circus', 'reflection'] },
  { file: 'essays/Scotland the Brave      James L.docx', title: 'Scotland the Brave', tags: ['travel', 'Scotland'] },
  { file: 'essays/Some thoughts on Ireland.docx', title: 'Some Thoughts on Ireland', tags: ['travel', 'Ireland'] },
  { file: 'essays/Songs in my life expanded.docx', title: 'Songs in My Life', tags: ['music', 'memoir'] },
  { file: 'essays/The French Lesson.docx', title: 'The French Lesson', tags: ['language', 'memoir'] },
  { file: 'essays/The Old Switcheroo.docx', title: 'The Old Switcheroo', tags: ['Sweden', 'history'] },
  { file: 'essays/Thinking God Knows What.docx', title: 'Thinking God Knows What: James Joyce and Trieste', tags: ['literature', 'James Joyce'] },
  { file: 'essays/Valborg rev.docx', title: 'Valborg', tags: ['Sweden', 'traditions'] },
  { file: 'How well do you know JIm Littlefield word.docx', title: 'How Well Do You Know Jim Littlefield? (The Vanity Game)', tags: ['family', 'memoir', 'artifacts'] },
  { file: 'Jim and Aleda.docx', title: 'Jim and Aleda: A Timeline', tags: ['family', 'memoir'] },
  { file: 'Top 25 Defining US events in last 60 y.docx', title: 'Top 25 Defining U.S. Events of the Last 60 Years', tags: ['history', 'United States'] },
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

function toPosix(filePath) {
  return filePath.split(sep).join('/');
}

function wordDocuments(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store' || name.endsWith('.icloud')) continue;
    const filePath = join(dir, name);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      wordDocuments(filePath, files);
    } else if (stats.isFile() && ['.doc', '.docx'].includes(extname(name).toLowerCase())) {
      files.push(toPosix(relative(ESSAY_DIR, filePath)));
    }
  }
  return files;
}

if (!existsSync(ESSAY_DIR)) {
  throw new Error(`Missing essay folder: ${ESSAY_DIR}`);
}

const sourceFiles = wordDocuments(ESSAY_DIR).sort();
const manifestFiles = manifest.map(({ file }) => file).sort();
const unlisted = sourceFiles.filter((file) => !manifestFiles.includes(file));
const missing = manifestFiles.filter((file) => !sourceFiles.includes(file));
if (unlisted.length || missing.length) {
  throw new Error(
    `Essay manifest does not match the source folder. Unlisted: ${unlisted.join(', ') || 'none'}. Missing: ${missing.join(', ') || 'none'}.`
  );
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
  const sourceExt = extname(sourcePath).toLowerCase();
  const originalPath = `originals/essays/${slug}${sourceExt}`;
  const stats = statSync(sourcePath);

  records.push({
    sourcePath,
    html,
    originalPath,
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
      source_file_path: originalPath,
      source_file_type: 'Word',
      source_file_size: stats.size,
      source_modified_at: stats.mtime.toISOString(),
      content_hash: createHash('sha256').update(readFileSync(sourcePath)).digest('hex'),
      status: 'published',
      featured: false,
    },
  });
}

console.log(`${DRY_RUN ? 'Dry run:' : 'Uploading'} ${records.length} essays`);

for (const { sourcePath, html, originalPath, row } of records) {
  console.log(`- ${row.slug} (${basename(sourcePath)} -> ${row.file_path}, ${originalPath})`);

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

  const { error: originalUploadError } = await supabase.storage
    .from(BUCKET)
    .upload(originalPath, readFileSync(sourcePath), {
      contentType: extname(sourcePath).toLowerCase() === '.doc'
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  if (originalUploadError) {
    throw new Error(`Upload failed for ${originalPath}: ${originalUploadError.message}`);
  }

  const { error: upsertError } = await supabase
    .from('documents')
    .upsert(row, { onConflict: 'slug' });

  if (upsertError) {
    throw new Error(`Upsert failed for ${row.slug}: ${upsertError.message}`);
  }
}

const unknownExts = records
  .map(({ sourcePath }) => extname(sourcePath).toLowerCase())
  .filter((ext) => !['.doc', '.docx'].includes(ext));
if (unknownExts.length > 0) {
  throw new Error(`Unexpected source extensions: ${unknownExts.join(', ')}`);
}
