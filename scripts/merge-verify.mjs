// Merge the IG-verification agents' results out of the session transcript.
// Scans for ```json arrays of {id,handle,status,suggested_handle,followers,note}
// and dedupes by id (prefer an entry that has a follower count / a decisive status).
// Prints counts only. Usage: node scripts/merge-verify.mjs <session.jsonl> <outFile>
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

const byId = new Map();
const fence = /```json\s*(\[[\s\S]*?\])\s*```/g;
const score = (r) => (r.followers != null ? 2 : 0) + (r.status && r.status !== 'unsure' ? 1 : 0);

for (const line of lines) {
  let obj; try { obj = JSON.parse(line); } catch { continue; }
  const t = textOf(obj);
  if (!t.includes('"status"') || !t.includes('"id"')) continue;
  fence.lastIndex = 0;
  let m;
  while ((m = fence.exec(t))) {
    let arr; try { arr = JSON.parse(m[1]); } catch { continue; }
    if (!Array.isArray(arr) || !arr.length || !arr[0] || !('id' in arr[0]) || !('status' in arr[0])) continue;
    for (const r of arr) {
      if (!r || !r.id) continue;
      const prev = byId.get(r.id);
      if (!prev || score(r) > score(prev)) byId.set(r.id, r);
    }
  }
}

const merged = [...byId.values()];
writeFileSync(outFile, JSON.stringify(merged, null, 1) + '\n');
const by = (s) => merged.filter((r) => r.status === s).length;
const withFollowers = merged.filter((r) => Number.isFinite(r.followers)).length;
const corrections = merged.filter((r) => r.suggested_handle && (r.status === 'wrong' || r.status === 'notfound')).length;
console.log(`merged unique orgs: ${merged.length}`);
console.log(`  ok:${by('ok')}  wrong:${by('wrong')}  notfound:${by('notfound')}  unsure:${by('unsure')}`);
console.log(`  with follower count: ${withFollowers}  |  handle corrections suggested: ${corrections}`);
console.log(`wrote ${outFile}`);
