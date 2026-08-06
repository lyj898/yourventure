// Apply business/entrepreneurship/consulting clubs (org_type 'Business/Entrepreneurship').
// If a club already exists on that campus (same IG handle or same name), RE-TAG it to
// Business/Entrepreneurship (and backfill follower/email/whatsapp if missing) instead of
// duplicating. Otherwise insert it. Mirrors changes into data/campuses/*.json.
// Usage: node --env-file=.env.local scripts/apply-business.mjs <merged.json>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const src = process.argv[2];
if (!src) { console.error('Usage: node --env-file=.env.local scripts/apply-business.mjs <merged.json>'); process.exit(1); }
const BT = 'Business/Entrepreneurship';
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const clean = (v) => (v == null || String(v).trim() === '' || /^(null|n\/a|na|-|none|unknown)$/i.test(String(v).trim()) ? null : String(v).trim());
const cleanWa = (v) => { const s = clean(v); if (!s) return null; if (/[a-zA-Z]/.test(s)) return /wa\.me|whatsapp/i.test(s) ? s : null; let d = s.replace(/[^\d]/g, ''); if (!d) return null; if (d.startsWith('0')) d = '62' + d.slice(1); if (!d.startsWith('62')) d = '62' + d; return '+' + d; };
const norm = (h) => (h ? String(h).trim().toLowerCase().replace(/^@/, '') : '');

const rows = JSON.parse(readFileSync(src, 'utf8'));
const { data: orgs } = await supabase.from('student_orgs').select('id,campus_id,name,contact_value,org_type,follower_count,email,whatsapp');
const { data: campuses } = await supabase.from('campuses').select('id,slug');
const slugById = new Map(campuses.map((c) => [c.id, c.slug]));
const byCampus = new Map();
for (const o of orgs) { if (!byCampus.has(o.campus_id)) byCampus.set(o.campus_id, []); byCampus.get(o.campus_id).push(o); }

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'campuses');
const files = new Set(readdirSync(dataDir));
const fileEdit = (slug, fn) => { const f = slug + '.json'; if (!files.has(f)) return; const p = join(dataDir, f); const c = JSON.parse(readFileSync(p, 'utf8')); if (fn(c)) writeFileSync(p, JSON.stringify(c, null, 2) + '\n'); };

let inserted = 0, retagged = 0, skipped = 0, missing = 0;
for (const r of rows) {
  const slug = slugById.get(r.campus_id);
  if (!slug) { missing++; continue; }
  const handle = norm(r.contact_value);
  const nm = (r.name || '').trim().toLowerCase();
  const existing = (byCampus.get(r.campus_id) || []).find(
    (o) => (handle && norm(o.contact_value) === handle) || (o.name && o.name.trim().toLowerCase() === nm),
  );
  const follower = Number.isFinite(r.follower_count) ? r.follower_count : null;
  const email = clean(r.email), wa = cleanWa(r.whatsapp);

  if (existing) {
    if (existing.org_type === BT) { skipped++; continue; }
    const patch = { org_type: BT };
    if (existing.follower_count == null && follower != null) patch.follower_count = follower;
    if (!existing.email && email) patch.email = email;
    if (!existing.whatsapp && wa) patch.whatsapp = wa;
    await supabase.from('student_orgs').update(patch).eq('id', existing.id);
    existing.org_type = BT;
    retagged++;
    fileEdit(slug, (c) => { let ch = false; for (const o of c.orgs || []) if ((o.name || '').trim().toLowerCase() === (existing.name || '').trim().toLowerCase()) { if (o.org_type !== BT) { o.org_type = BT; ch = true; } if (o.follower_count == null && follower != null) { o.follower_count = follower; ch = true; } if (!o.email && email) { o.email = email; ch = true; } if (!o.whatsapp && wa) { o.whatsapp = wa; ch = true; } } return ch; });
  } else {
    const org = { campus_id: r.campus_id, name: clean(r.name), org_type: BT, contact_type: 'Instagram', contact_value: clean(r.contact_value), follower_count: follower, email, whatsapp: wa, notes: clean(r.notes) };
    const { error } = await supabase.from('student_orgs').insert(org);
    if (error) { console.error(`  x ${r.name}: ${error.message}`); continue; }
    (byCampus.get(r.campus_id) || byCampus.set(r.campus_id, []).get(r.campus_id)).push({ ...org });
    inserted++;
    const { campus_id, ...fileOrg } = org;
    fileEdit(slug, (c) => { if ((c.orgs || []).some((o) => (o.name || '').trim().toLowerCase() === nm)) return false; c.orgs = [...(c.orgs || []), fileOrg]; return true; });
  }
}
console.log(`\nBusiness clubs — inserted: ${inserted}, re-tagged existing: ${retagged}, already tagged: ${skipped}` + (missing ? `, unknown campus: ${missing}` : ''));
process.exit(0);
