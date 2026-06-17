/**
 * Seed the `family_trees` table from the family tree data.
 *
 * One-off migration of the hardcoded `familyTrees` constant in
 * src/pages/main/family-tree.astro into the database, so the tree can be
 * edited through the admin UI instead of in source.
 *
 * Single source of truth: scripts/family-tree-seed.json. On first run (before
 * the artifact exists) the data is extracted from the astro file's inline
 * literal, augmented, and written to that JSON. Subsequent runs read the JSON
 * (so re-seeding still works after the literal is removed from the page).
 *
 * IMPORTANT — jsonb does NOT preserve object key order. The renderer lays out
 * generations via the order of `structure`'s keys, so we persist an explicit
 * `generationOrder` array (order survives jsonb) plus a `generationLabels` map
 * (so labels are editable and survive new generations). The render loop reads
 * those instead of `Object.keys(structure)`.
 *
 * Usage:
 *   node scripts/seed-family-trees.mjs --dry-run
 *   node scripts/seed-family-trees.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = join(ROOT, '.env');
const ASTRO_FILE = join(ROOT, 'src', 'pages', 'main', 'family-tree.astro');
const SEED_JSON = join(ROOT, 'scripts', 'family-tree-seed.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Display order of the two trees (matches the hardcoded tab buttons).
const SORT_ORDER = { littlefield: 0, ostrom: 1 };

// Generation labels, replicated from the renderer in family-tree.astro so the
// seeded `generationLabels` map reproduces today's labels exactly.
const GEN_LABELS = {
  greatGreatGrandparents: '2x Great-Grandparents',
  greatGrandparents: 'Great-Grandparents',
  grandparents: 'Grandparents',
  parents: 'Parents',
  current: 'Current',
  children: 'Children',
  children_of_anders_ida: "Anders & Ida's Children",
  grandchildren: 'Grandchildren',
  greatGrandchildren: 'Great-Grandchildren',
  greatGreatGrandchildren: 'Great-Great-Grandchildren',
};

function resolveGenLabel(treeKey, gk) {
  // The renderer special-cases the "current" generation per tree.
  if (gk === 'current') return treeKey === 'littlefield' ? 'Jim & Aleda' : 'Current';
  return GEN_LABELS[gk] || gk;
}

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

/** Order-independent for object keys, order-dependent for arrays. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function extractFamilyTrees() {
  if (existsSync(SEED_JSON)) {
    console.log(`Reading seed artifact: ${SEED_JSON}`);
    return JSON.parse(readFileSync(SEED_JSON, 'utf8'));
  }

  console.log(`Extracting familyTrees literal from: ${ASTRO_FILE}`);
  const src = readFileSync(ASTRO_FILE, 'utf8');
  const line = src.split('\n').find((l) => l.includes('const familyTrees='));
  if (!line) throw new Error('Could not find `const familyTrees=` literal in the astro file');
  const literal = line.trim().replace(/^const familyTrees=/, '').replace(/;\s*$/, '');
  // eslint-disable-next-line no-new-func — trusted source, our own file
  const trees = new Function(`return (${literal});`)();

  // Augment each tree with explicit ordering + labels (jsonb-safe).
  for (const [treeKey, tree] of Object.entries(trees)) {
    const keys = Object.keys(tree.structure);
    tree.generationOrder = keys;
    tree.generationLabels = Object.fromEntries(keys.map((gk) => [gk, resolveGenLabel(treeKey, gk)]));
  }

  writeFileSync(SEED_JSON, `${JSON.stringify(trees, null, 2)}\n`);
  console.log(`Wrote seed artifact: ${SEED_JSON}`);
  return trees;
}

const trees = extractFamilyTrees();
const treeKeys = Object.keys(trees);
console.log(`\n${DRY_RUN ? 'Dry run:' : 'Seeding'} ${treeKeys.length} tree(s): ${treeKeys.join(', ')}`);
for (const key of treeKeys) {
  const t = trees[key];
  console.log(
    `  - ${key}: "${t.label}"  people=${Object.keys(t.people).length}  generations=${t.generationOrder.length}`,
  );
}

if (DRY_RUN) {
  console.log('\nDry run complete. No database writes.');
  process.exit(0);
}

const env = loadEnv(ENV_FILE);
const { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('');
for (const key of treeKeys) {
  const row = {
    tree_key: key,
    label: trees[key].label,
    sort_order: SORT_ORDER[key] ?? 99,
    data: trees[key],
  };
  const { error } = await supabase.from('family_trees').upsert(row, { onConflict: 'tree_key' });
  if (error) throw new Error(`Upsert failed for ${key}: ${error.message}`);
  console.log(`  upserted ${key} ✓`);
}

// Round-trip verification: fetched data must deep-equal the source.
console.log('\nVerifying round-trip...');
const { data: rows, error: fetchError } = await supabase
  .from('family_trees')
  .select('tree_key, data')
  .order('sort_order', { ascending: true });
if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);

let allMatch = true;
for (const key of treeKeys) {
  const fetched = rows.find((r) => r.tree_key === key)?.data;
  if (!fetched) {
    console.error(`  ✗ ${key}: not found in DB`);
    allMatch = false;
    continue;
  }
  if (deepEqual(fetched, trees[key])) {
    console.log(`  ✓ ${key}: identical`);
  } else {
    console.error(`  ✗ ${key}: MISMATCH after round-trip`);
    allMatch = false;
  }
}

if (!allMatch) {
  console.error('\nRound-trip verification FAILED. Data may be corrupted.');
  process.exit(1);
}
console.log('\nDone. Trees seeded and verified identical.');
