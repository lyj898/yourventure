// Seed / import pipeline for the Indonesia Campus Directory.
//
// Reads every data/campuses/*.json file and upserts it into Supabase via the API.
// This is the reusable way to populate the DB as we add campuses — edit/add a JSON
// file, then run `npm run seed`.
//
// Auth: uses the Supabase SERVICE ROLE (secret) key, which bypasses RLS. That key is
// read from the environment (SUPABASE_SERVICE_ROLE_KEY in .env.local) and must NEVER be
// committed or exposed to the browser. `npm run seed` loads it via `node --env-file`.
//
// Idempotency:
//   - campuses  -> upsert by slug (re-running updates campus fields from the JSON)
//   - orgs      -> inserted only if no org with the same name exists for that campus,
//                  so manual edits made in the app UI are never clobbered.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '\n✖ Missing env. Add these to .env.local (gitignored), then run `npm run seed`:\n' +
      '    PUBLIC_SUPABASE_URL=...            (already set for the app)\n' +
      '    SUPABASE_SERVICE_ROLE_KEY=...      (Supabase → Settings → API Keys → secret key)\n',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'campuses');
const files = readdirSync(dataDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.log('No campus files in data/campuses/. Nothing to seed.');
  process.exit(0);
}

let totalOrgsInserted = 0;
let totalOrgsSkipped = 0;
let hadError = false;

for (const file of files) {
  const { orgs = [], ...campus } = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));

  // Upsert the campus by its unique slug.
  const { data: row, error: campusErr } = await supabase
    .from('campuses')
    .upsert(campus, { onConflict: 'slug' })
    .select('id')
    .single();

  if (campusErr) {
    console.error(`✖ ${campus.slug}: campus upsert failed — ${campusErr.message}`);
    hadError = true;
    continue;
  }
  const campusId = row.id;

  // Insert only orgs whose name isn't already present for this campus.
  const { data: existing, error: exErr } = await supabase
    .from('student_orgs')
    .select('name')
    .eq('campus_id', campusId);

  if (exErr) {
    console.error(`✖ ${campus.slug}: reading existing orgs failed — ${exErr.message}`);
    hadError = true;
    continue;
  }

  const present = new Set((existing ?? []).map((o) => o.name));
  const toInsert = orgs
    .filter((o) => !present.has(o.name))
    .map((o) => ({ ...o, campus_id: campusId }));
  const skipped = orgs.length - toInsert.length;

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('student_orgs').insert(toInsert);
    if (insErr) {
      console.error(`✖ ${campus.slug}: inserting orgs failed — ${insErr.message}`);
      hadError = true;
      continue;
    }
  }

  totalOrgsInserted += toInsert.length;
  totalOrgsSkipped += skipped;
  console.log(
    `✓ ${campus.name.padEnd(28)} +${toInsert.length} orgs` +
      (skipped ? ` (${skipped} already present)` : ''),
  );
}

console.log(
  `\nDone — ${files.length} campus file(s). Orgs inserted: ${totalOrgsInserted}, ` +
    `skipped (already there): ${totalOrgsSkipped}.`,
);

process.exit(hadError ? 1 : 0);
