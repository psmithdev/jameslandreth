import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..');
const PHOTO_DIR = join(ROOT, 'tmp', 'artifact-photos');
const PROPOSALS_FILE = join(ROOT, 'tmp', 'photo-proposals.json');
const MAP_FILE = join(ROOT, 'scripts', 'artifact-photo-map.json');
const ENV_FILE = join(ROOT, '.env');
const PORT = 3847;

// ── Parse .env ──────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    console.error(`Missing ${filePath}`);
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
const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── MIME types ───────────────────────────────────────────────────────
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
};

// ── Route handlers ──────────────────────────────────────────────────
function serveHTML(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(buildHTML());
}

function servePhoto(res, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    res.writeHead(400);
    res.end('Invalid filename');
    return;
  }
  const filePath = join(PHOTO_DIR, safeName);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = extname(safeName).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
}

function serveProposals(res) {
  if (!existsSync(PROPOSALS_FILE)) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'No proposals file. Run: npm run classify-photos' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(readFileSync(PROPOSALS_FILE, 'utf-8'));
}

async function serveArtifacts(res) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('slug, title, category')
    .order('title');

  if (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleSubmit(req, res, server) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  // Validate shape: { string: string[] }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Expected object with slug → filename[] entries' }));
    return;
  }
  for (const [, v] of Object.entries(body)) {
    if (!Array.isArray(v) || !v.every((f) => typeof f === 'string')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Each value must be a string[]' }));
      return;
    }
  }

  writeFileSync(MAP_FILE, JSON.stringify(body, null, 2) + '\n');
  const totalFiles = Object.values(body).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\nMapping saved: ${totalFiles} photos → ${Object.keys(body).length} artifacts`);
  console.log(`Written to ${MAP_FILE}`);
  console.log('Next step: npm run upload-photos');

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, file: MAP_FILE }));

  // Shut down gracefully after response is sent
  setTimeout(() => {
    server.close(() => process.exit(0));
  }, 100);
}

// ── HTML page ───────────────────────────────────────────────────────
function buildHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Artifact Photo Review</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .summary { color: #666; margin-bottom: 24px; font-size: 14px; }
  .section-title { font-size: 18px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #ddd; }
  .artifact-group { margin-bottom: 32px; }
  .artifact-group h3 { font-size: 15px; color: #555; margin-bottom: 8px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card img { width: 100%; height: 200px; object-fit: cover; display: block; }
  .card-body { padding: 12px; }
  .card-filename { font-size: 12px; color: #999; margin-bottom: 4px; font-family: monospace; }
  .card-reasoning { font-size: 13px; color: #666; margin-bottom: 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-high { background: #d4edda; color: #155724; }
  .badge-mid { background: #fff3cd; color: #856404; }
  .badge-low { background: #f8d7da; color: #721c24; }
  .card-controls { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .card-controls select { flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
  .card-controls input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
  .submit-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 16px 24px; box-shadow: 0 -2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .submit-bar button { background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 600; }
  .submit-bar button:hover { background: #1d4ed8; }
  .submit-bar button:disabled { background: #94a3b8; cursor: not-allowed; }
  .submit-count { font-size: 14px; color: #666; }
  .content { padding-bottom: 80px; }
  .loading { text-align: center; padding: 48px; color: #999; }
</style>
</head>
<body>
<div class="content" id="app">
  <div class="loading">Loading proposals...</div>
</div>
<div class="submit-bar">
  <span class="submit-count" id="submit-count"></span>
  <button id="submit-btn" onclick="submitMapping()">Save Mapping & Exit</button>
</div>

<script>
let proposals = [];
let artifacts = [];

async function init() {
  try {
    const [propRes, artRes] = await Promise.all([
      fetch('/proposals').then(r => r.json()),
      fetch('/artifacts').then(r => r.json()),
    ]);
    proposals = propRes.proposals || [];
    artifacts = artRes;
    render();
  } catch (err) {
    document.getElementById('app').innerHTML = '<p style="color:red">Failed to load: ' + err.message + '</p>';
  }
}

function badgeClass(c) {
  if (c > 0.8) return 'badge-high';
  if (c >= 0.5) return 'badge-mid';
  return 'badge-low';
}

function artifactOptions(selectedSlug) {
  let html = '<option value="">— dismiss —</option>';
  for (const a of artifacts) {
    const sel = a.slug === selectedSlug ? ' selected' : '';
    html += '<option value="' + a.slug + '"' + sel + '>' + a.title + ' (' + a.category + ')</option>';
  }
  return html;
}

function render() {
  const matched = proposals.filter(p => p.slug !== null);
  const unmatched = proposals.filter(p => p.slug === null);

  // Group matched by slug
  const groups = {};
  for (const p of matched) {
    if (!groups[p.slug]) groups[p.slug] = [];
    groups[p.slug].push(p);
  }

  let html = '<h1>Artifact Photo Review</h1>';
  html += '<p class="summary">' + proposals.length + ' photos analyzed, ' + matched.length + ' matched, ' + unmatched.length + ' unmatched</p>';

  // Matched
  if (matched.length > 0) {
    html += '<div class="section-title">Matched Photos</div>';
    for (const slug of Object.keys(groups).sort()) {
      const art = artifacts.find(a => a.slug === slug);
      const title = art ? art.title : slug;
      html += '<div class="artifact-group"><h3>' + title + '</h3><div class="cards">';
      for (const p of groups[slug]) {
        html += cardHTML(p);
      }
      html += '</div></div>';
    }
  }

  // Unmatched
  if (unmatched.length > 0) {
    html += '<div class="section-title">Unmatched Photos</div>';
    html += '<div class="cards">';
    for (const p of unmatched) {
      html += cardHTML(p);
    }
    html += '</div>';
  }

  document.getElementById('app').innerHTML = html;
  updateCount();
}

function cardHTML(p) {
  const checked = p.slug && p.confidence > 0.8 ? ' checked' : '';
  return '<div class="card">' +
    '<img src="/photos/' + encodeURIComponent(p.filename) + '" loading="lazy" />' +
    '<div class="card-body">' +
      '<div class="card-filename">' + p.filename + ' <span class="badge ' + badgeClass(p.confidence) + '">' + Math.round(p.confidence * 100) + '%</span></div>' +
      '<div class="card-reasoning">' + (p.reasoning || '') + '</div>' +
      '<div class="card-controls">' +
        '<select data-filename="' + p.filename + '" onchange="updateCount()">' + artifactOptions(p.slug) + '</select>' +
        '<input type="checkbox" data-filename="' + p.filename + '"' + checked + ' onchange="updateCount()" title="Include in mapping" />' +
      '</div>' +
    '</div></div>';
}

function updateCount() {
  const checked = document.querySelectorAll('input[type="checkbox"]:checked');
  let count = 0;
  checked.forEach(cb => {
    const sel = document.querySelector('select[data-filename="' + cb.dataset.filename + '"]');
    if (sel && sel.value) count++;
  });
  document.getElementById('submit-count').textContent = count + ' photo(s) selected';
  document.getElementById('submit-btn').disabled = count === 0;
}

async function submitMapping() {
  const mapping = {};
  const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach(cb => {
    const filename = cb.dataset.filename;
    const sel = document.querySelector('select[data-filename="' + filename + '"]');
    if (!sel || !sel.value) return;
    const slug = sel.value;
    if (!mapping[slug]) mapping[slug] = [];
    mapping[slug].push(filename);
  });

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('app').innerHTML =
        '<div style="text-align:center;padding:48px">' +
        '<h2>Mapping saved!</h2>' +
        '<p style="color:#666;margin-top:8px">Written to scripts/artifact-photo-map.json</p>' +
        '<p style="color:#666;margin-top:4px">Next: <code>npm run upload-photos</code></p>' +
        '</div>';
      document.querySelector('.submit-bar').style.display = 'none';
    }
  } catch (err) {
    btn.textContent = 'Save Mapping & Exit';
    btn.disabled = false;
    alert('Error: ' + err.message);
  }
}

init();
</script>
</body>
</html>`;
}

// ── Server ──────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(PROPOSALS_FILE)) {
    console.error(`No proposals file found at ${PROPOSALS_FILE}`);
    console.error('Run classify first: npm run classify-photos');
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    try {
      if (req.method === 'GET' && url.pathname === '/') {
        serveHTML(res);
      } else if (req.method === 'GET' && url.pathname.startsWith('/photos/')) {
        const filename = decodeURIComponent(url.pathname.slice('/photos/'.length));
        servePhoto(res, filename);
      } else if (req.method === 'GET' && url.pathname === '/proposals') {
        serveProposals(res);
      } else if (req.method === 'GET' && url.pathname === '/artifacts') {
        await serveArtifacts(res);
      } else if (req.method === 'POST' && url.pathname === '/submit') {
        await handleSubmit(req, res, server);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      console.error('Request error:', err);
      res.writeHead(500);
      res.end('Internal error');
    }
  });

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Review UI running at ${url}`);
    console.log('Press Ctrl+C to quit without saving.\n');

    // Auto-open browser
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${cmd} ${url}`, () => {});
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
