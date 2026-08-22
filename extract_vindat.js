// extract_vindat.js - build a fast_<chassis>.json straight from the FAST binaries.
//
// WHY THIS EXISTS
//
// The 40 fast_*.json exports in public/data had no extractor anywhere in the
// repo. They were the only copy of the data, which is why nothing here ever
// deletes one. It also meant a chassis that was missed the first time could
// never be added: ECR32 (15,475 records) and ER32 (2,011) are real R32 chassis
// sitting in the source that the site simply did not hold, so ECR32-007552 came
// back "not found" for a car that exists.
//
// THE RECORD FORMAT, worked out from the binaries and then verified
//
//   VINDAT<n>.<vol> is a flat run of fixed-width records. The width is NOT
//   constant across the file - it is len(chassis code) + 26 - so FR32 records
//   are 30 bytes and ECR32 records are 31. Records for one chassis are
//   contiguous, which is what makes a fixed stride work within a chassis.
//
//   [0 .. L-1]   chassis code, ASCII, L = 4 or 5   e.g. "FR32", "ECR32"
//   [L]          block digit                       always "0" on R32
//   [L+1 .. L+3] serial, 24-bit big-endian
//   [L+4 .. L+5] build date, 16-bit big-endian, read as decimal YYMM
//                  0x2396 = 9110 = 1991-10
//   [L+6]        a single colour-related character (see below)
//   [L+7 .. L+9] paint code, 3 chars              e.g. "KH2"
//   [L+10..L+13] spaces
//   [L+14]       interior code                    e.g. "5"
//   [L+15..L+17] spaces
//   [L+18]       0x00
//   [L+19..L+21] pointer, 24-bit big-endian, a byte offset into MDLCODE.<vol>
//                where the 20-character factory model code lives
//   [L+22..L+25] 0x00
//
//   The character at [L+6] is dropped, because all five R32 exports that
//   already ship dropped it: every colour code in fast_fr32/hr32/hcr32/bnr32/
//   hnr32.json is 3 characters. Keeping it here would make these two files
//   disagree with their five siblings and would put a stray character in front
//   of every R32 paint name. What it means is not established, so it is
//   discarded rather than guessed at - see the note in the README of findings.
//
// WHY YOU CAN TRUST THE OUTPUT
//
//   --verify re-extracts a chassis the site already ships and compares the
//   result against the committed file, field by field. It reproduces all five
//   R32 chassis exactly - same record count, same dictionaries in the same
//   order, same rows. The code that produces the two new files is the code
//   that reproduces the five known ones.
//
// USAGE
//   node extract_vindat.js --verify                    check against shipped files
//   node extract_vindat.js --chassis ECR32 --write     write public/data/fast_ecr32.json

'use strict';
const fs = require('fs');
const path = require('path');

const SRC = 'H:/AR-JP/JP';
const OUT_DIR = path.join(__dirname, 'public', 'data');

// Which volume each chassis lives in. Found by tallying the codes across every
// VINDAT file; both R32 volumes pair with MDLCODE.AB2 for the model code.
const LOCATION = {
  FR32:  { vindat: 'VINDAT4.AB2', mdlcode: 'MDLCODE.AB2' },
  HR32:  { vindat: 'VINDAT4.AB2', mdlcode: 'MDLCODE.AB2' },
  ER32:  { vindat: 'VINDAT4.AB2', mdlcode: 'MDLCODE.AB2' },
  ECR32: { vindat: 'VINDAT5.AB2', mdlcode: 'MDLCODE.AB2' },
  HCR32: { vindat: 'VINDAT5.AB2', mdlcode: 'MDLCODE.AB2' },
  HNR32: { vindat: 'VINDAT5.AB2', mdlcode: 'MDLCODE.AB2' },
  BNR32: { vindat: 'VINDAT5.AB2', mdlcode: 'MDLCODE.AB2' }
};

const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const ascii = (b, o, n) => b.subarray(o, o + n).toString('ascii');

/**
 * Every offset in `buf` holding a valid record for this chassis.
 *
 * Anchoring on the code alone is not enough - "R32" sits inside "ECR32" and
 * "HCR32", and a stray match would shift every field after it. Each candidate
 * is therefore shape-checked: block digit, a month in 1..12, a printable paint
 * code, and the two runs of spaces the layout requires. A record that fails any
 * of those is not a record.
 */
function findRecords(buf, code) {
  const L = code.length;
  const tag = Buffer.from(code, 'ascii');
  const offsets = [];
  let i = 0;
  while ((i = buf.indexOf(tag, i)) >= 0) {
    const o = i;
    i += 1;
    if (o + L + 26 > buf.length) continue;
    // The byte before must not be a letter, or we matched inside a longer code.
    if (o > 0) { const p = buf[o - 1]; if (p >= 65 && p <= 90) continue; }
    const blk = buf[o + L];
    if (blk < 0x30 || blk > 0x39) continue;
    const ymm = be16(buf, o + L + 4);
    const mo = ymm % 100;
    if (mo < 1 || mo > 12) continue;
    const yr = Math.floor(ymm / 100);
    if (yr < 60 || yr > 99) continue;
    const paint = ascii(buf, o + L + 7, 3);
    if (!/^[A-Z0-9]{3}$/.test(paint)) continue;
    // [L+10..L+13] and [L+15..L+17] are usually spaces but are NOT padding -
    // they carry data on a minority of records ("2   " and "  *" turn up on
    // the 17 BNR32 cars in two-tone 2M8, for one). Requiring spaces there
    // silently dropped real records, and dropped them in a way that looked
    // like a clean extract: 43,878 of 43,895 with no error. The structural
    // anchors are the nulls, which hold on every record in every chassis.
    if (buf[o + L + 18] !== 0x00) continue;
    if (be24(buf, o + L + 22) !== 0 || buf[o + L + 25] !== 0x00) continue;
    offsets.push(o);
  }
  return offsets;
}

function extract(code) {
  const loc = LOCATION[code];
  if (!loc) throw new Error('No source location known for ' + code);
  const buf = fs.readFileSync(path.join(SRC, loc.vindat));
  const mdl = fs.readFileSync(path.join(SRC, loc.mdlcode));
  const L = code.length;

  const offsets = findRecords(buf, code);

  // Dictionaries are built in first-seen order, which is what the shipped
  // files do - row 0 of every one of them indexes 0 into each dictionary.
  const b = [], d = [], c = [], t = [], mc = [];
  const bi = new Map(), di = new Map(), ci = new Map(), ti = new Map(), mci = new Map();
  const intern = (arr, map, v) => {
    let k = map.get(v);
    if (k === undefined) { k = arr.length; arr.push(v); map.set(v, k); }
    return k;
  };

  const rows = offsets.map(o => {
    const block = String.fromCharCode(buf[o + L]);
    const serial = be24(buf, o + L + 1);
    const ymm = be16(buf, o + L + 4);
    const date = '19' + String(Math.floor(ymm / 100)).padStart(2, '0') +
                 '-' + String(ymm % 100).padStart(2, '0');
    // [L+6] deliberately skipped - see the note at the top of this file.
    const paint = ascii(buf, o + L + 7, 3);
    const interior = String.fromCharCode(buf[o + L + 14]);
    const ptr = be24(buf, o + L + 19);
    const model = ptr + 20 <= mdl.length ? ascii(mdl, ptr, 20) : '';
    return [
      intern(b, bi, block),
      serial,
      intern(d, di, date),
      intern(c, ci, paint),
      intern(t, ti, interior),
      intern(mc, mci, model)
    ];
  });

  return { m: code, n: rows.length, b, d, c, t, mc, r: rows };
}

// ---------------------------------------------------------------------------

function compare(code) {
  const file = path.join(OUT_DIR, 'fast_' + code.toLowerCase() + '.json');
  if (!fs.existsSync(file)) return { code, status: 'no shipped file to compare' };
  const want = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const got = extract(code);

  const diffs = [];
  if (got.n !== want.n) diffs.push(`count ${got.n} vs ${want.n}`);
  for (const k of ['b', 'd', 'c', 't', 'mc']) {
    if (JSON.stringify(got[k]) !== JSON.stringify(want[k])) {
      diffs.push(`${k}: ${got[k].length} entries vs ${want[k].length}` +
        (got[k].length === want[k].length ? ' (same size, different order or values)' : ''));
    }
  }
  if (!diffs.length) {
    let bad = 0;
    for (let i = 0; i < want.r.length; i++) {
      if (JSON.stringify(got.r[i]) !== JSON.stringify(want.r[i])) { if (bad < 3) diffs.push(`row ${i}: ${JSON.stringify(got.r[i])} vs ${JSON.stringify(want.r[i])}`); bad++; }
    }
    if (bad) diffs.push(`${bad} rows differ in total`);
  }
  return { code, status: diffs.length ? 'MISMATCH' : 'exact match', diffs, n: got.n };
}

const args = process.argv.slice(2);

if (args.includes('--verify')) {
  const known = ['FR32', 'HR32', 'HCR32', 'HNR32', 'BNR32'];
  let ok = 0;
  for (const code of known) {
    const r = compare(code);
    console.log(`${code.padEnd(6)} ${String(r.n || '').padStart(7)}  ${r.status}`);
    if (r.diffs && r.diffs.length) r.diffs.slice(0, 5).forEach(x => console.log('        ' + x));
    if (r.status === 'exact match') ok++;
  }
  console.log(`\n${ok}/${known.length} chassis reproduced exactly.`);
  process.exit(ok === known.length ? 0 : 1);
}

const ci = args.indexOf('--chassis');
if (ci >= 0 && args[ci + 1]) {
  const code = args[ci + 1].toUpperCase();
  const out = extract(code);
  console.log(`${code}: ${out.n.toLocaleString()} records`);
  console.log(`  dates  ${out.d.length} (${out.d.slice().sort()[0]} .. ${out.d.slice().sort().pop()})`);
  console.log(`  paints ${out.c.length}  interiors ${out.t.length}  model codes ${out.mc.length}`);
  const sers = out.r.map(r => r[1]);
  console.log(`  serial ${Math.min(...sers)} .. ${Math.max(...sers)}`);
  if (args.includes('--write')) {
    const file = path.join(OUT_DIR, 'fast_' + code.toLowerCase() + '.json');
    fs.writeFileSync(file, JSON.stringify(out) + '\n', 'utf8');
    console.log(`  wrote ${path.relative(__dirname, file)} (${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.log('  (dry run - pass --write to save)');
  }
  process.exit(0);
}

console.log('usage: node extract_vindat.js --verify');
console.log('       node extract_vindat.js --chassis ECR32 [--write]');
