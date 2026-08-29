// add_hr31_engine.js - annotate HR31 with the engine character, so the ~6% of
// records whose stored model code dropped it (10,790 of 182,351) get their
// specific RB20 instead of the model's engine range.
//
// The engine letter (F/H/R/S per volume 078's legend) sits immediately before
// the [J]R31 chassis fragment in the full MDLCODE code. Most HR31 codes keep
// it; where the export truncated it, it is still there one byte before the
// stored code. Same recover-the-dropped-character method as add_r32_engine.js,
// same safety: no re-extraction, every shipped record kept exactly and matched
// back by (block, serial, model code), an `ed` dictionary plus a seventh row
// element appended, and the five existing columns asserted byte-identical.
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = 'H:/AR-JP/JP';
const OUT = path.join(__dirname, 'public', 'data');
const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const ascii = (b, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i] || 32); return s; };

const CODE = 'HR31', VIN = 'VINDAT4.AB2', MDLF = 'MDLCODE.AB2';

function sourceEngineMap() {
  const buf = fs.readFileSync(path.join(SRC, VIN));
  const mdl = fs.readFileSync(path.join(SRC, MDLF));
  const L = CODE.length, bytes = Buffer.from(CODE, 'latin1');
  const map = new Map(), conflicts = new Set();
  let i = 0;
  while ((i = buf.indexOf(bytes, i)) >= 0) {
    const s = i; i++;
    const blk = buf[s + L]; if (blk < 0x30 || blk > 0x39) continue;
    const ser = be24(buf, s + L + 1);
    const ptr = be24(buf, s + L + 19);
    if (ptr < 6 || ptr + 20 > mdl.length) continue;
    const mc = ascii(mdl, ptr, 20);
    if (!mc.endsWith('R31')) continue;
    const stripped = mc.replace(/\s+R31\s*$/, '');
    // full code = up to 6 chars before ptr + the stored code, so the engine
    // letter is present whether it was kept in the stored code or dropped.
    const full = ascii(mdl, ptr - 6, 6) + stripped;
    const m = full.match(/([FHRS])J?R31/);
    if (!m) continue;
    const key = String.fromCharCode(blk) + '|' + ser + '|' + mc;
    if (map.has(key) && map.get(key) !== m[1]) conflicts.add(key);
    map.set(key, m[1]);
  }
  return { map, conflicts };
}

const file = path.join(OUT, 'fast_' + CODE.toLowerCase() + '.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
if (doc.ed) { console.log(CODE + ': already annotated'); process.exit(0); }

const { map, conflicts } = sourceEngineMap();
const edDict = [], edIdx = new Map();
const edi = v => { if (!edIdx.has(v)) { edIdx.set(v, edDict.length); edDict.push(v); } return edIdx.get(v); };

const before = JSON.stringify(doc.r.map(r => r.slice(0, 6)));
let matched = 0, missing = 0;
const tally = new Map();
for (const row of doc.r) {
  const block = (doc.b || ['0'])[row[0]] || '0';
  const mc = (doc.mc || [])[row[5]] || '';
  const key = block + '|' + row[1] + '|' + mc;
  let e = map.get(key);
  if (conflicts.has(key)) e = '';
  if (e === undefined || !/[FHRS]/.test(e || '')) e = '';
  if (e) matched++; else missing++;
  tally.set(e || '(none)', (tally.get(e || '(none)') || 0) + 1);
  row.push(edi(e));
}
if (JSON.stringify(doc.r.map(r => r.slice(0, 6))) !== before) {
  console.error(CODE + ': FATAL - existing row data changed'); process.exit(1);
}
doc.ed = edDict;
fs.writeFileSync(file, JSON.stringify(doc));
console.log(CODE + '  n=' + doc.r.length + '  matched=' + matched + '  missing=' + missing +
  '  conflicts=' + conflicts.size + '   ' +
  [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join('  '));
