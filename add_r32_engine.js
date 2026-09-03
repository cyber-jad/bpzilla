// add_r32_engine.js - annotate HR32 with the engine character the export dropped.
//
// HR32 is the one R32 chassis whose file mixes two engines, and the site could
// not tell them apart: the RB20E (GTE) and RB20DE (GTS) cars can carry an
// identical stored model code, differing only in a leading character the export
// truncated. Volume 079's legend gives the engine field as F=CA18i, H=RB20E,
// R=RB20DE/DET, B=RB26DETT, E=RB25DE; in MDLCODE it is the letter immediately
// before the (optional C/N) + R32 platform fragment of the full plate code.
//
// Same method and same safety as add_body_field.js: no re-extraction, every
// shipped record kept exactly and matched back to its MDLCODE entry by
// (block, serial, model code), the engine letter read from the full code, and
// an `ed` dictionary plus a seventh row element appended. The five existing
// columns must be byte-identical or the script aborts.
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = 'H:/AR-JP/JP';
const OUT = path.join(__dirname, 'public', 'data');
const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const ascii = (b, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i] || 32); return s; };

const CODE = 'HR32', VIN = 'VINDAT4.AB2', MDLF = 'MDLCODE.AB2';

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
    // ptr < 4 would read before the start of MDLCODE when the 4-byte prefix
    // below is taken at ptr-4.
    if (ptr < 4 || ptr + 20 > mdl.length) continue;
    const mc = ascii(mdl, ptr, 20);
    if (!mc.endsWith('R32')) continue;
    // full code = up to 4 chars before ptr + the stored code; the engine is the
    // letter right before the (optional chassis letter) and the R32 platform.
    const full = ascii(mdl, ptr - 4, 4) + mc;
    const m = full.match(/([FHRBE])[CN]?R32/);
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
  if (e === undefined || !/[FHRBE]/.test(e || '')) e = '';
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
