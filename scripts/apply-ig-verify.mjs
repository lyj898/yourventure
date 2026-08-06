// Apply IG-verification results.
//  - follower_count: overwrite where a fresh integer was read.
//  - contact_value: correct the handle where status is wrong/notfound AND a
//    verified suggested_handle is present.
// Also writes changes back into data/campuses/<slug>.json, and prints a report of
// everything that still needs human eyes (wrong/notfound/unsure).
// Usage: node --env-file=.env.local scripts/apply-ig-verify.mjs <merged.json>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const src = process.argv[2];
if (!src) { console.error('Usage: node --env-file=.env.local scripts/apply-ig-verify.mjs <merged.json>'); process.exit(1); }
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = JSON.parse(readFileSync(src, 'utf8'));
const normHandle = (h) => {
  if (!h || typeof h !== 'string') return null;
  let s = h.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').replace(/^@/, '');
  return s ? '@' + s : null;
};

// id -> {slug,name,current handle}
const { data: orgs } = await supabase.from('student_orgs').select('id,name,contact_value,campus_id');
const { data: campuses } = await supabase.from('campuses').select('id,slug');
const slugById = new Map(campuses.map((c) => [c.id, c.slug]));
const metaById = new Map(orgs.map((o) => [o.id, { slug: slugById.get(o.campus_id), name: o.name, handle: o.contact_value }]));

let followerUpdates = 0, handleFixes = 0, missing = 0;
const fileEdits = new Map(); // slug -> [{name, follower_count?, contact_value?}]
const corrections = [];       // applied handle fixes
const review = [];            // needs manual attention

for (const r of results) {
  const meta = metaById.get(r.id);
  if (!meta) { missing++; continue; }
  const patch = {};
  const suggested = normHandle(r.suggested_handle);
  const applyingCorrection =
    (r.status === 'wrong' || r.status === 'notfound') && suggested && suggested.toLowerCase() !== (meta.handle || '').toLowerCase();

  if (applyingCorrection) {
    patch.contact_value = suggested;
    corrections.push({ org: meta.name, from: meta.handle, to: suggested, why: r.status });
  }

  // Only trust a follower count for a confirmed-correct account, or one we're
  // correcting to the right handle. Never attribute a wrong/hijacked account's count.
  if (Number.isFinite(r.followers) && r.followers >= 0 && (r.status === 'ok' || applyingCorrection)) {
    patch.follower_count = Math.round(r.followers);
  }

  if (r.status === 'wrong' || r.status === 'notfound' || r.status === 'unsure') {
    review.push({ org: meta.name, handle: meta.handle, status: r.status, suggestion: suggested || '-', note: r.note || '' });
  }

  if (Object.keys(patch).length === 0) continue;
  const { error } = await supabase.from('student_orgs').update(patch).eq('id', r.id);
  if (error) { console.error(`  x ${r.id}: ${error.message}`); continue; }
  if ('follower_count' in patch) followerUpdates++;
  if ('contact_value' in patch) handleFixes++;

  if (meta.slug) {
    if (!fileEdits.has(meta.slug)) fileEdits.set(meta.slug, []);
    fileEdits.get(meta.slug).push({ name: meta.name, ...patch });
  }
}

// write back to data files
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'campuses');
const files = new Set(readdirSync(dataDir));
let filesTouched = 0;
for (const [slug, edits] of fileEdits) {
  const fname = slug + '.json';
  if (!files.has(fname)) continue;
  const p = join(dataDir, fname);
  const campus = JSON.parse(readFileSync(p, 'utf8'));
  let changed = false;
  for (const org of campus.orgs || []) {
    const e = edits.find((x) => x.name === org.name);
    if (!e) continue;
    if ('follower_count' in e && org.follower_count !== e.follower_count) { org.follower_count = e.follower_count; changed = true; }
    if ('contact_value' in e && org.contact_value !== e.contact_value) { org.contact_value = e.contact_value; changed = true; }
  }
  if (changed) { writeFileSync(p, JSON.stringify(campus, null, 2) + '\n'); filesTouched++; }
}

console.log(`\nFollower counts updated: ${followerUpdates}`);
console.log(`Handles corrected: ${handleFixes}`);
console.log(`Data files updated: ${filesTouched}`);
if (missing) console.log(`Unknown ids skipped: ${missing}`);

if (corrections.length) {
  console.log(`\n=== HANDLE CORRECTIONS APPLIED (${corrections.length}) ===`);
  for (const c of corrections) console.log(`  ${c.org}: ${c.from} -> ${c.to}  (${c.why})`);
}
const noFix = review.filter((r) => r.suggestion === '-');
console.log(`\n=== NEEDS REVIEW (${review.length}: wrong/notfound/unsure; ${noFix.length} without a suggested fix) ===`);
for (const r of review) console.log(`  [${r.status}] ${r.org} — ${r.handle}${r.suggestion !== '-' ? ' -> ' + r.suggestion : ''}  ${r.note}`);
process.exit(0);
