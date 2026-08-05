// Merge the enrichment agents' results out of the session transcript.
// The agents' JSON came back via task-notifications, which are recorded in the
// session .jsonl. We scan it for every ```json array of {id,email,whatsapp}
// objects and dedupe by id (first non-null value wins). Prints counts only.
// Usage: node scripts/merge-enrichment.mjs <session.jsonl> <outFile>
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
let arraysSeen = 0;

for (const line of lines) {
  let obj; try { obj = JSON.parse(line); } catch { continue; }
  const t = textOf(obj);
  if (!t.includes('"whatsapp"') && !t.includes('"email"')) continue;
  if (!t.includes('"id"')) continue;
  fence.lastIndex = 0;
  let m;
  while ((m = fence.exec(t))) {
    let arr; try { arr = JSON.parse(m[1]); } catch { continue; }
    if (!Array.isArray(arr) || !arr.length || !arr[0] || !('id' in arr[0])) continue;
    if (!('email' in arr[0]) && !('whatsapp' in arr[0])) continue;
    arraysSeen++;
    for (const r of arr) {
      if (!r || !r.id) continue;
      const prev = byId.get(r.id) || { id: r.id, email: null, whatsapp: null };
      if (!prev.email && r.email) prev.email = r.email;
      if (!prev.whatsapp && r.whatsapp) prev.whatsapp = r.whatsapp;
      byId.set(r.id, prev);
    }
  }
}

const merged = [...byId.values()];
writeFileSync(outFile, JSON.stringify(merged, null, 1) + '\n');
const withEmail = merged.filter((r) => r.email).length;
const withWa = merged.filter((r) => r.whatsapp).length;
console.log(`json arrays matched: ${arraysSeen}`);
console.log(`merged unique orgs with a contact: ${merged.length}  (email: ${withEmail}, whatsapp: ${withWa})`);
console.log(`wrote ${outFile}`);
