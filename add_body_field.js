// add_body_field.js - annotate the R33/R34 archive with the body-style
// character the original extraction dropped.
//
// The FAST export stores each car's model code starting at the ENGINE. The
// character before it - model-plate position 1, 車体形状 in volume 080/081's
// legend - is the body: 'B' = 4-door sedan, 'G' = 2-door coupe. It sits in
// MDLCODE at pointer-1 and was simply never read.
//
// This does NOT re-extract. Re-deriving which records exist is what a rewrite
// would risk getting wrong (a stricter record walk drops real cars). Instead
// every existing record is kept exactly as shipped and only annotated: each
// row is matched back to its source VINDAT record by (block, serial, model
// code), the body character at pointer-1 is read, and a `bd` dictionary plus a
// seventh row element are added. Everything else in the file is untouched, and
// the script refuses to write if any existing field changed.
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = 'H:/AR-JP/JP';
const OUT = path.join(__dirname, 'public', 'data');
const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const ascii = (b, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]); return s; };

// chassis -> its VINDAT file (all share MDLCODE.AB2)
const LOC = {
  BCNR33: 'VINDAT6.AB2', ECR33: 'VINDAT5.AB2', ENR33: 'VINDAT5.AB2',
  ER33: 'VINDAT4.AB2', HR33: 'VINDAT4.AB2',
  BNR34: 'VINDAT5.AB2', ENR34: 'VINDAT5.AB2', ER34: 'VINDAT4.AB2', HR34: 'VINDAT4.AB2'
};
const MDL = 'MDLCODE.AB2';

// Build (block|serial|mc) -> body for one chassis by scanning every plausible
// source record. The mc in the key is what disambiguates the rare case of two
// cars sharing a block+serial across a dual numbering sequence.
function sourceBodyMap(code) {
  const buf = fs.readFileSync(path.join(SRC, LOC[code]));
  const mdl = fs.readFileSync(path.join(SRC, MDL));
  const L = code.length;
  const bytes = Buffer.from(code, 'latin1');
  const map = new Map();
  const conflicts = new Set();
  const gen = code.slice(-3);                        // 'R33' or 'R34'
  let i = 0;
  while ((i = buf.indexOf(bytes, i)) >= 0) {
    const start = i; i += 1;
    const blk = buf[start + L];
    if (blk < 0x30 || blk > 0x39) continue;
    // No "preceded by a letter" guard here: it falsely rejects real records
    // whose neighbour's tail byte is a letter (1,113 genuine BNR34s), and it
    // is not needed - none of these codes is a substring of another, and the
    // exact (block, serial, mc) key plus the generation-suffix check below
    // make a chance byte match impossible.
    const ser = be24(buf, start + L + 1);
    const ptr = be24(buf, start + L + 19);
    if (ptr < 1 || ptr + 20 > mdl.length) continue;
    const mc = ascii(mdl, ptr, 20);
    if (!mc.endsWith(gen)) continue;                 // a real model code ends with its generation
    const body = String.fromCharCode(mdl[ptr - 1]);
    const key = String.fromCharCode(blk) + '|' + ser + '|' + mc;
    if (map.has(key) && map.get(key) !== body) conflicts.add(key);
    map.set(key, body);
  }
  return { map, conflicts };
}

function augment(code) {
  const file = path.join(OUT, 'fast_' + code.toLowerCase() + '.json');
  if (!fs.existsSync(file)) return console.log(code + ': no json, skipped');
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const doc = JSON.parse(raw);
  if (doc.bd) return console.log(code + ': already has a body field, skipped');

  const { map, conflicts } = sourceBodyMap(code);
  const bdDict = [];
  const bdIdx = new Map();
  const bdi = (v) => { if (!bdIdx.has(v)) { bdIdx.set(v, bdDict.length); bdDict.push(v); } return bdIdx.get(v); };

  const before = JSON.stringify(doc.r);
  let matched = 0, missing = 0, bad = 0;
  const bodyTally = new Map();
  for (const row of doc.r) {
    const block = (doc.b || ['0'])[row[0]] || '0';
    const ser = row[1];
    const mc = (doc.mc || [])[row[5]] || '';
    const key = block + '|' + ser + '|' + mc;
    let body = map.get(key);
    if (conflicts.has(key)) body = '';                // ambiguous -> leave unknown
    if (body === undefined) body = '';
    if (body && !/[BG]/.test(body)) { bad++; body = ''; } // R33/R34 body is B or G only
    if (body) matched++; else missing++;
    bodyTally.set(body || '(none)', (bodyTally.get(body || '(none)') || 0) + 1);
    row.push(bdi(body));                              // 7th element
  }
  // the existing five index columns must be byte-identical
  const afterFirst6 = JSON.stringify(doc.r.map(r => r.slice(0, 6)));
  if (afterFirst6 !== before) { console.error(code + ': FATAL - existing row data changed, aborting'); process.exit(1); }

  doc.bd = bdDict;
  fs.writeFileSync(file, JSON.stringify(doc));
  const tally = [...bodyTally.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join('  ');
  console.log(code.padEnd(8) + ' n=' + doc.r.length + '  matched=' + matched + '  missing=' + missing +
              '  conflictsSeen=' + conflicts.size + '  badChar=' + bad + '   ' + tally);
}

for (const code of Object.keys(LOC)) augment(code);
