// Pull the career-centre agents' results out of the session transcript.
// Scans for ```json arrays of {campus_id, name, contact_type, contact_value,
// email, whatsapp, notes} and dedupes by campus_id. Prints counts only.
// Usage: node scripts/merge-careers.mjs <session.jsonl> <outFile>
import { readFileSync, writeFileSync } from 'node:fs';
const [transcript, outFile] = process.argv.slice(2);
const lines = readFileSync(transcript, 'utf8').split('\n').filter(Boolean);
function textOf(node) {
  const out = [];
  (function walk(x) {
    if (x == null) return;
    if (typeof x === 'string') { out.push(x); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === 'object') {
      if (typeof x.text === 'string') out.push(x.text);
      for (const k of Object.keys(x)) if (k !== 'text') walk(x[k]);
    }
  })(node);
  return out.join('\n');
}
const byCampus = new Map();
const fence = /```json\s*(\[[\s\S]*?\])\s*```/g;
for (const line of lines) {
  let obj; try { obj = JSON.parse(line); } catch { continue; }
  const t = textOf(obj);
  if (!t.includes('"campus_id"') || !t.includes('"contact_type"')) continue;
  fence.lastIndex = 0;
  let m;
  while ((m = fence.exec(t))) {
    let arr; try { arr = JSON.parse(m[1]); } catch { continue; }
    if (!Array.isArray(arr) || !arr.length || !arr[0] || !('campus_id' in arr[0]) || !('contact_type' in arr[0])) continue;
    for (const r of arr) {
      if (!r || !r.campus_id || !r.name) continue;
      if (!byCampus.has(r.campus_id)) byCampus.set(r.campus_id, r);
    }
  }
}
const merged = [...byCampus.values()];
writeFileSync(outFile, JSON.stringify(merged, null, 1) + '\n');
console.log(`career centres found (unique campuses): ${merged.length}`);
const byType = {};
for (const r of merged) byType[r.contact_type] = (byType[r.contact_type] || 0) + 1;
console.log('by primary contact:', JSON.stringify(byType));
console.log('with email:', merged.filter((r) => r.email).length, '| with whatsapp:', merged.filter((r) => r.whatsapp).length);
console.log('wrote', outFile);
