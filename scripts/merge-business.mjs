// Pull the business-club agents' results out of the session transcript.
// Multiple clubs per campus, so dedupe by campus_id + name.
// Usage: node scripts/merge-business.mjs <session.jsonl> <outFile>
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
const byKey = new Map();
const fence = /```json\s*(\[[\s\S]*?\])\s*```/g;
for (const line of lines) {
  let obj; try { obj = JSON.parse(line); } catch { continue; }
  const t = textOf(obj);
  if (!t.includes('"campus_id"') || !t.includes('"contact_value"')) continue;
  fence.lastIndex = 0;
  let m;
  while ((m = fence.exec(t))) {
    let arr; try { arr = JSON.parse(m[1]); } catch { continue; }
    if (!Array.isArray(arr) || !arr.length || !arr[0] || !('campus_id' in arr[0]) || !('contact_value' in arr[0])) continue;
    // only business-club arrays carry follower_count alongside campus_id
    if (!('follower_count' in arr[0])) continue;
    for (const r of arr) {
      if (!r || !r.campus_id || !r.name) continue;
      const key = r.campus_id + '|' + r.name.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, r);
    }
  }
}
const merged = [...byKey.values()];
writeFileSync(outFile, JSON.stringify(merged, null, 1) + '\n');
const campuses = new Set(merged.map((r) => r.campus_id));
console.log(`business/entrepreneurship clubs: ${merged.length} across ${campuses.size} campuses`);
console.log('with email:', merged.filter((r) => r.email).length, '| with whatsapp:', merged.filter((r) => r.whatsapp).length);
console.log('wrote', outFile);
