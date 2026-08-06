// Classify student orgs. RUNNING -> normalise org_type to 'UKM Olahraga/Lari'
// (the running tag). NON-RUNNING SPORT -> delete. Governance (BEM/DPM/HIMA) and
// everything else -> keep untouched. Dry-run by default; pass --apply to execute.
// Deletes/edits both the live DB and the data/campuses/*.json files.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const s = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RUN = /\b(run|runs|runner|runners|running)\b|\blari\b|marathon|\bultra\b|\btrail\b|atletik|athletic|track\s*&?\s*field|tnf\b/i;
const ESPORT = /e-?sports?|gaming/i;
const SPORT = /basket|futsal|voli|volley|bulu\s?tangkis|badminton|taekwondo|karate|\bsilat\b|pencak|\bpsht\b|sepak\s?bola|sepakbola|football|\bfc\b|\bfutbol\b|renang|swim|tenis|tennis|\bcatur\b|panahan|archery|hoki|hockey|rugby|\bbola\b|olahraga|\bsports?\b|wushu|tinju|boxing|panjat|climbing|bulutangkis|voly|volly|bela\s?diri|judo|anggar|mapala|pecinta alam/i;
const GOV = new Set(['BEM Universitas', 'BEM Fakultas', 'DPM', 'HIMA']);

const { data: orgs } = await s.from('student_orgs').select('id,name,contact_value,org_type,campus_id');
const { data: campuses } = await s.from('campuses').select('id,slug,name');
const campById = new Map(campuses.map((c) => [c.id, c]));

const running = [], sport = [], other = [];
for (const o of orgs) {
  const hay = `${o.name || ''} ${o.contact_value || ''}`;
  const isGov = GOV.has(o.org_type);
  const isRun = RUN.test(hay);
  const isEsport = ESPORT.test(hay);
  const isSport = !isGov && !isEsport && (SPORT.test(hay) || o.org_type === 'UKM Olahraga/Lari');
  if (isRun && !isGov) running.push(o);
  else if (isSport) sport.push(o);
  else other.push(o);
}
console.log(`TOTAL orgs: ${orgs.length}`);
console.log(`RUNNING (keep + tag as 'UKM Olahraga/Lari'): ${running.length}`);
console.log(`NON-RUNNING SPORT (delete): ${sport.length}`);
console.log(`OTHER / governance (keep): ${other.length}`);

if (!APPLY) {
  console.log('\n--- would DELETE (non-running sport) ---');
  for (const o of sport) console.log(`  ${(o.contact_value || '').padEnd(26)} ${o.name} [${o.org_type}] | ${campById.get(o.campus_id)?.name}`);
  console.log('\n(DRY RUN — pass --apply to execute)');
  process.exit(0);
}

// ── APPLY ──
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'campuses');
const files = new Set(readdirSync(dataDir));
const editFile = (slug, fn) => {
  const name = slug + '.json';
  if (!files.has(name)) return;
  const p = join(dataDir, name);
  const c = JSON.parse(readFileSync(p, 'utf8'));
  if (fn(c)) writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
};

// 1) delete non-running sport
const delIds = sport.map((o) => o.id);
for (let i = 0; i < delIds.length; i += 100) {
  const { error } = await s.from('student_orgs').delete().in('id', delIds.slice(i, i + 100));
  if (error) { console.error('delete error:', error.message); process.exit(1); }
}
// remove from files, grouped by campus
const delByCampus = new Map();
for (const o of sport) { const sl = campById.get(o.campus_id)?.slug; if (sl) { if (!delByCampus.has(sl)) delByCampus.set(sl, new Set()); delByCampus.get(sl).add(o.name); } }
for (const [slug, names] of delByCampus) editFile(slug, (c) => { const before = c.orgs?.length || 0; c.orgs = (c.orgs || []).filter((o) => !names.has(o.name)); return c.orgs.length !== before; });

// 2) normalise running org_type
let retyped = 0;
const runByCampus = new Map();
for (const o of running) {
  if (o.org_type !== 'UKM Olahraga/Lari') {
    const { error } = await s.from('student_orgs').update({ org_type: 'UKM Olahraga/Lari' }).eq('id', o.id);
    if (!error) retyped++;
    const sl = campById.get(o.campus_id)?.slug; if (sl) { if (!runByCampus.has(sl)) runByCampus.set(sl, new Set()); runByCampus.get(sl).add(o.name); }
  }
}
for (const [slug, names] of runByCampus) editFile(slug, (c) => { let ch = false; for (const o of c.orgs || []) if (names.has(o.name) && o.org_type !== 'UKM Olahraga/Lari') { o.org_type = 'UKM Olahraga/Lari'; ch = true; } return ch; });

console.log(`\nDELETED ${delIds.length} non-running sport orgs.`);
console.log(`Tagged ${running.length} running orgs (re-typed ${retyped} that weren't already 'UKM Olahraga/Lari').`);
process.exit(0);
