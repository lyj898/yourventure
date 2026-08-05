// Apply email/WhatsApp enrichment produced by the research agents.
// Input: a JSON array of { id, email, whatsapp } (email/whatsapp may be null).
// 1) UPDATEs the live student_orgs rows by id (service-role key).
// 2) Writes the values back into data/campuses/<slug>.json (matched by org name)
//    so a future `npm run seed` keeps them.
// Usage: node --env-file=.env.local scripts/apply-enrichment.mjs <results.json>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node --env-file=.env.local scripts/apply-enrichment.mjs <results.json>');
  process.exit(1);
}
const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const clean = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /^(null|n\/a|na|-|none|unknown)$/i.test(s)) return null;
  return s;
};
const cleanWa = (v) => {
  const s = clean(v);
  if (!s) return null;
  // wa.me/message/<code> click-to-chat links have no raw number — keep the URL as-is.
  if (/[a-zA-Z]/.test(s)) return /wa\.me|whatsapp|api\.whatsapp/i.test(s) ? s : null;
  // otherwise normalise a phone number to +62… E.164-ish
  let d = s.replace(/[^\d]/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (!d.startsWith('62')) d = '62' + d;
  return '+' + d;
};

const results = JSON.parse(readFileSync(src, 'utf8'));
const rows = Array.isArray(results) ? results : results.results || [];

// Map id -> {slug, name} for file write-back.
const { data: orgs } = await supabase.from('student_orgs').select('id,name,campus_id');
const { data: campuses } = await supabase.from('campuses').select('id,slug');
const slugById = new Map(campuses.map((c) => [c.id, c.slug]));
const metaById = new Map(orgs.map((o) => [o.id, { slug: slugById.get(o.campus_id), name: o.name }]));

let dbUpdated = 0, emailN = 0, waN = 0, missing = 0;
const fileEdits = new Map(); // slug -> Map(name -> {email, whatsapp})

for (const r of rows) {
  const id = r.id;
  const email = clean(r.email);
  const whatsapp = cleanWa(r.whatsapp);
  if (!email && !whatsapp) continue;
  if (!metaById.has(id)) { missing++; continue; }

  const patch = {};
  if (email) { patch.email = email; emailN++; }
  if (whatsapp) { patch.whatsapp = whatsapp; waN++; }

  const { error } = await supabase.from('student_orgs').update(patch).eq('id', id);
  if (error) { console.error(`  ✖ ${id}: ${error.message}`); continue; }
  dbUpdated++;

  const meta = metaById.get(id);
  if (meta?.slug) {
    if (!fileEdits.has(meta.slug)) fileEdits.set(meta.slug, new Map());
    fileEdits.get(meta.slug).set(meta.name, { ...patch });
  }
}

// Write values back into the data files.
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
    const e = edits.get(org.name);
    if (!e) continue;
    if (e.email && org.email !== e.email) { org.email = e.email; changed = true; }
    if (e.whatsapp && org.whatsapp !== e.whatsapp) { org.whatsapp = e.whatsapp; changed = true; }
  }
  if (changed) { writeFileSync(p, JSON.stringify(campus, null, 2) + '\n'); filesTouched++; }
}

console.log(`\nDB rows updated: ${dbUpdated}  (emails: ${emailN}, whatsapp: ${waN})`);
console.log(`Data files updated: ${filesTouched}`);
if (missing) console.log(`Entries with unknown id (skipped): ${missing}`);
process.exit(0);
