/**
 * Scan reviewed iCloud documents and upload approved records to Supabase.
 *
 * Usage:
 *   npm run documents:scan
 *   npm run documents:dry-run
 *   npm run documents:upload
 *
 * New scan discoveries are written with include:false. Review
 * scripts/document-manifest.json and flip include to true before uploading.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST_FILE = join(ROOT, 'scripts', 'document-manifest.json');
const ENV_FILE = join(ROOT, '.env');
const TMP_DIR = join(ROOT, 'tmp', 'document-html');
const BUCKET = 'documents';
const DEFAULT_SOURCE_ROOT = '~/Library/Mobile Documents/com~apple~CloudDocs/Website';
const SUPPORTED_EXTS = new Set(['.doc', '.docx', '.pdf', '.pptx']);

const args = process.argv.slice(2);
const mode = args.includes('--upload') ? 'upload' : args.includes('--dry-run') ? 'dry-run' : 'scan';
const sourceArg = valueAfter('--source');
const sourceRoot = expandHome(sourceArg || DEFAULT_SOURCE_ROOT);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] || null;
}

function expandHome(path) {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

function toPosix(path) {
  return path.split(sep).join('/');
}

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

function loadManifest() {
  if (!existsSync(MANIFEST_FILE)) {
    return { sourceRoot: DEFAULT_SOURCE_ROOT, entries: [] };
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
  if (!Array.isArray(manifest.entries)) {
    throw new Error(`${MANIFEST_FILE} must contain an entries array`);
  }
  return manifest;
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store' || name.endsWith('.icloud')) continue;
    const fullPath = join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
    } else if (stats.isFile() && SUPPORTED_EXTS.has(extname(name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanSourceFiles(root) {
  if (!existsSync(root)) {
    throw new Error(`Source folder not found: ${root}`);
  }

  const files = [];
  for (const name of readdirSync(root)) {
    if (name === 'ALL Household INVENTORY' || name === '.claude' || name === '.DS_Store') continue;
    const fullPath = join(root, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (name === 'Essays') files.push(...walk(fullPath));
      continue;
    }
    if (stats.isFile() && SUPPORTED_EXTS.has(extname(name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => toPosix(relative(root, a)).localeCompare(toPosix(relative(root, b))));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function titleFromFile(filePath) {
  const raw = basename(filePath, extname(filePath))
    .replace(/\s+/g, ' ')
    .replace(/\brev(?:ised)?\b/gi, '')
    .replace(/\bcopy\b/gi, '')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return raw
    .split(' ')
    .map((word) => {
      if (/^(and|or|the|to|of|in|my|on|for|from)$/i.test(word)) return word.toLowerCase();
      if (/^(US|JIM)$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/\bA\b/g, 'a')
    .replace(/\bAt\b/g, 'at')
    .replace(/\bBut\b/g, 'but')
    .replace(/\bJIm\b/g, 'Jim')
    .replace(/\bQunatum\b/g, 'Quantum');
}

function categoryFor(relativePath, ext) {
  if (relativePath.startsWith('Essays/essays/')) return 'Essay';
  if (/retrospective/i.test(relativePath) || ext === '.pptx') return 'Presentation';
  if (/aleda|jim|family/i.test(relativePath)) return 'Family';
  return 'Essay';
}

function fileTypeFor(ext, previewType = null) {
  if (previewType) return previewType;
  if (ext === '.pdf') return 'PDF';
  if (ext === '.pptx') return 'PowerPoint';
  return 'Word';
}

function inferEntry(filePath, root) {
  const rel = toPosix(relative(root, filePath));
  const ext = extname(filePath).toLowerCase();
  const title = titleFromFile(filePath);
  return {
    include: false,
    sourcePath: rel,
    slug: slugify(title),
    title,
    category: categoryFor(rel, ext),
    excerpt: null,
    date: null,
    year: null,
    location: null,
    tags: [],
    pages: null,
    featured: false,
    status: 'published',
  };
}

function mergeManifestWithScan(manifest, files, root) {
  const bySource = new Map(manifest.entries.map((entry) => [entry.sourcePath, entry]));
  const scannedSources = new Set();
  const merged = [];
  let added = 0;

  for (const file of files) {
    const sourcePath = toPosix(relative(root, file));
    scannedSources.add(sourcePath);
    if (bySource.has(sourcePath)) {
      merged.push(bySource.get(sourcePath));
    } else {
      merged.push(inferEntry(file, root));
      added++;
    }
  }

  const removed = manifest.entries.filter((entry) => !scannedSources.has(entry.sourcePath));
  for (const entry of removed) {
    merged.push({ ...entry, include: false, missing: true });
  }

  return {
    manifest: { sourceRoot: sourceArg || manifest.sourceRoot || DEFAULT_SOURCE_ROOT, entries: merged },
    added,
    missing: removed.length,
  };
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

function pageEstimate(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.ceil(words / 500));
  return `${pages} ${pages === 1 ? 'page' : 'pages'}`;
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function mimeTypeFor(ext) {
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return 'application/octet-stream';
}

function validateEntry(entry) {
  const required = ['sourcePath', 'slug', 'title', 'category', 'status'];
  for (const field of required) {
    if (!entry[field]) throw new Error(`Manifest entry missing ${field}: ${JSON.stringify(entry)}`);
  }
  if (!['published', 'draft', 'archived'].includes(entry.status)) {
    throw new Error(`${entry.slug}: status must be published, draft, or archived`);
  }
}

function buildRecord(entry, sourcePath, root) {
  const ext = extname(sourcePath).toLowerCase();
  const stats = statSync(sourcePath);
  const contentHash = hashFile(sourcePath);
  const base = slugify(entry.slug || entry.title);
  const originalPath = `originals/${base}${ext}`;

  let html = null;
  let filePath = originalPath;
  let fileType = fileTypeFor(ext);
  let excerpt = entry.excerpt || null;
  let pages = entry.pages || null;

  if (ext === '.doc' || ext === '.docx') {
    mkdirSync(TMP_DIR, { recursive: true });
    const htmlPath = join(TMP_DIR, `${base}.html`);
    const text = textFor(sourcePath);
    html = htmlFor(sourcePath, htmlPath);
    filePath = `previews/${base}.html`;
    fileType = 'HTML';
    excerpt = excerpt || excerptFrom(text, entry.title);
    pages = pages || pageEstimate(text);
  }

  return {
    html,
    originalPath,
    previewPath: filePath,
    row: {
      slug: base,
      title: entry.title,
      category: entry.category,
      excerpt,
      date: entry.date || null,
      year: entry.year ?? null,
      location: entry.location || null,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      pages,
      file_type: fileType,
      file_path: filePath,
      source_file_path: originalPath,
      source_file_type: fileTypeFor(ext),
      source_file_size: stats.size,
      source_modified_at: stats.mtime.toISOString(),
      content_hash: contentHash,
      featured: Boolean(entry.featured),
      status: entry.status || 'published',
    },
    relativeSource: toPosix(relative(root, sourcePath)),
  };
}

async function uploadObject(supabase, path, body, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
}

async function runUploadLike(manifest, root, dryRun) {
  const included = manifest.entries.filter((entry) => entry.include && !entry.missing);
  const slugs = new Set();
  const plans = [];

  for (const entry of included) {
    validateEntry(entry);
    if (slugs.has(entry.slug)) throw new Error(`Duplicate included slug: ${entry.slug}`);
    slugs.add(entry.slug);

    const sourcePath = join(root, entry.sourcePath);
    if (!existsSync(sourcePath)) throw new Error(`${entry.slug}: source file not found: ${sourcePath}`);
    plans.push(buildRecord(entry, sourcePath, root));
  }

  console.log(`${dryRun ? 'Dry run' : 'Uploading'} ${plans.length} included document(s)`);
  for (const plan of plans) {
    console.log(`- ${plan.row.slug}: ${plan.relativeSource} -> ${plan.row.file_path}`);
  }

  if (dryRun || plans.length === 0) return;

  const env = loadEnv(ENV_FILE);
  const { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const plan of plans) {
    const sourcePath = join(root, plan.relativeSource);
    const ext = extname(sourcePath).toLowerCase();

    if (plan.html) {
      await uploadObject(
        supabase,
        plan.previewPath,
        new Blob([plan.html], { type: mimeTypeFor('.html') }),
        mimeTypeFor('.html')
      );
    }

    await uploadObject(supabase, plan.originalPath, readFileSync(sourcePath), mimeTypeFor(ext));

    const { error } = await supabase.from('documents').upsert(plan.row, { onConflict: 'slug' });
    if (error) throw new Error(`Upsert failed for ${plan.row.slug}: ${error.message}`);
    console.log(`  uploaded ${plan.row.slug}`);
  }
}

async function main() {
  const manifest = loadManifest();
  const root = resolve(expandHome(sourceArg || manifest.sourceRoot || DEFAULT_SOURCE_ROOT));

  if (mode === 'scan') {
    const files = scanSourceFiles(root);
    const result = mergeManifestWithScan(manifest, files, root);
    saveManifest(result.manifest);
    console.log(`Scanned ${files.length} file(s) from ${root}`);
    console.log(`Added ${result.added} new manifest entr${result.added === 1 ? 'y' : 'ies'}`);
    console.log(`Marked ${result.missing} missing entr${result.missing === 1 ? 'y' : 'ies'}`);
    console.log(`Review ${MANIFEST_FILE} and set include:true for documents to publish.`);
    return;
  }

  await runUploadLike(manifest, root, mode === 'dry-run');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
