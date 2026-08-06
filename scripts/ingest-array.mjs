// Split a JSON array of campus objects (as returned by the research agents) into
// individual data/campuses/<slug>.json files, keeping only the DB-backed fields.
// Usage: node scripts/ingest-array.mjs <path-to-array.json>
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/ingest-array.mjs <array.json>');
  process.exit(1);
}
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'campuses');

const CAMPUS_KEYS = ['slug', 'name', 'type', 'ownership', 'city', 'province', 'future_series_city', 'website'];
const ORG_KEYS = ['name', 'org_type', 'contact_type', 'contact_value', 'follower_count', 'email', 'whatsapp', 'notes'];
const unescape = (s) =>
  typeof s === 'string'
    ? s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : s;

const existing = new Set(readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));
const arr = JSON.parse(readFileSync(src, 'utf8'));
if (!Array.isArray(arr)) {
  console.error('Input is not a JSON array.');
  process.exit(1);
}

let wrote = 0, skipped = 0;
for (const c of arr) {
  if (!c || !c.slug || !c.name || !c.future_series_city) {
    console.warn('  ! skipping malformed entry:', JSON.stringify(c)?.slice(0, 80));
    continue;
  }
  if (existing.has(c.slug)) {
    console.log(`  = ${c.slug} already exists — skipped`);
    skipped++;
    continue;
  }
  const out = {};
  for (const k of CAMPUS_KEYS) if (c[k] !== undefined) out[k] = unescape(c[k]);
  out.orgs = (Array.isArray(c.orgs) ? c.orgs : []).map((o) => {
    const oo = {};
    for (const k of ORG_KEYS) if (o[k] !== undefined) oo[k] = unescape(o[k]);
    if (oo.follower_count === undefined) oo.follower_count = null;
    return oo;
  });
  writeFileSync(join(dataDir, c.slug + '.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`  + ${c.slug.padEnd(40)} ${out.orgs.length} orgs`);
  wrote++;
}
console.log(`\nWrote ${wrote} new file(s), skipped ${skipped}.`);
