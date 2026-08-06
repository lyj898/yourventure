// Insert career-centre rows (org_type = 'Career Center') into student_orgs and the
// data/campuses files. Idempotent: skips a campus that already has a Career Center row.
// Usage: node --env-file=.env.local scripts/apply-careers.mjs <merged.json>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const src = process.argv[2];
if (!src) { console.error('Usage: node --env-file=.env.local scripts/apply-careers.mjs <merged.json>'); process.exit(1); }
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const clean = (v) => (v == null || /^(null|n\/a|na|-|none|unknown)$/i.test(String(v).trim()) || String(v).trim() === '' ? null : String(v).trim());
const cleanWa = (v) => {
  const s = clean(v); if (!s) return null;
  if (/[a-zA-Z]/.test(s)) return /wa\.me|whatsapp/i.test(s) ? s : null;
  let d = s.replace(/[^\d]/g, ''); if (!d) return null;
  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (!d.startsWith('62')) d = '62' + d;
  return '+' + d;
};
// contact_type must be a valid enum; default anything odd to Website/Other.
const CT = new Set(['Instagram', 'Email', 'WhatsApp', 'LinkedIn', 'Website', 'Other']);

const rows = JSON.parse(readFileSync(src, 'utf8'));
const { data: existing } = await supabase.from('student_orgs').select('campus_id').eq('org_type', 'Career Center');
const already = new Set((existing ?? []).map((o) => o.campus_id));
const { data: campuses } = await supabase.from('campuses').select('id,slug');
const slugById = new Map(campuses.map((c) => [c.id, c.slug]));

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'campuses');
const files = new Set(readdirSync(dataDir));
let inserted = 0, skipped = 0, filesTouched = 0, missing = 0;

for (const r of rows) {
  if (!slugById.has(r.campus_id)) { missing++; continue; }
  if (already.has(r.campus_id)) { skipped++; continue; }
  const ct = CT.has(r.contact_type) ? r.contact_type : 'Website';
  const org = {
    campus_id: r.campus_id,
    name: clean(r.name),
    org_type: 'Career Center',
    contact_type: ct,
    contact_value: clean(r.contact_value),
    email: clean(r.email),
    whatsapp: cleanWa(r.whatsapp),
    notes: clean(r.notes),
  };
  const { error } = await supabase.from('student_orgs').insert(org);
  if (error) { console.error(`  x ${r.name}: ${error.message}`); continue; }
  inserted++;
  already.add(r.campus_id);

  // write to data file (strip campus_id for the file shape)
  const slug = slugById.get(r.campus_id);
  const fn = slug + '.json';
  if (files.has(fn)) {
    const p = join(dataDir, fn);
    const c = JSON.parse(readFileSync(p, 'utf8'));
    const { campus_id, ...fileOrg } = org;
    if (!(c.orgs || []).some((o) => o.name === fileOrg.name)) {
      c.orgs = [...(c.orgs || []), { ...fileOrg, follower_count: null }];
      writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
      filesTouched++;
    }
  }
}
console.log(`\nCareer centres inserted: ${inserted} | skipped (already had one): ${skipped} | files updated: ${filesTouched}` + (missing ? ` | unknown campus: ${missing}` : ''));
process.exit(0);
