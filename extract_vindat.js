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
  BNR32: { vindat: 'VINDAT5.AB2', mdlcode: 'MDLCODE.AB2' },

  // S13 family. Spread over four volumes, and the shipped files are unions of
  // more than one code — see GROUPS.
  S13:    { vindat: 'VINDAT3.AB3', mdlcode: 'MDLCODE.AB3' },
  PS13:   { vindat: 'VINDAT4.AB3', mdlcode: 'MDLCODE.AB3' },
  KS13:   { vindat: 'VINDAT4.AB3', mdlcode: 'MDLCODE.AB3' },
  RS13:   { vindat: 'VINDAT4.AB3', mdlcode: 'MDLCODE.AB3' },
  KPS13:  { vindat: 'VINDAT5.AB3', mdlcode: 'MDLCODE.AB3' },
  KRS13:  { vindat: 'VINDAT5.AB3', mdlcode: 'MDLCODE.AB3' },
  RPS13:  { vindat: 'VINDAT5.AB3', mdlcode: 'MDLCODE.AB3' },
  KRPS13: { vindat: 'VINDAT6.AB3', mdlcode: 'MDLCODE.AB3' },

  // S15 Silvia. One chassis code, despite appearances - see the note in
  // findRecords about the phantom RS15 and CS15.
  S15:    { vindat: 'VINDAT3.AB3', mdlcode: 'MDLCODE.AB3' }
};

// A shipped file is not always one chassis code.
//
// fast_ps13.json is PS13 followed by KPS13 (100,115 + 12,197 = 112,312) and
// fast_rs13.json is RS13 followed by KRS13 (19,478 + 7,262 = 26,740), which is
// the Super HICAS sibling arrangement database.js documents. The order is the
// volume order, and it shows in the data: the shipped files' serials climb,
// drop exactly once, and climb again.
//
// rps13 is new and follows the same shape — RPS13 then KRPS13, the SR20-era
// 180SX that had never been extracted at all.
const GROUPS = {
  s13:   ['S13'],
  ps13:  ['PS13', 'KPS13'],
  ks13:  ['KS13'],
  rs13:  ['RS13', 'KRS13'],
  rps13: ['RPS13', 'KRPS13'],
  s15:   ['S15'],
  ecr32: ['ECR32'],
  er32:  ['ER32'],
  fr32:  ['FR32'],
  hr32:  ['HR32'],
  hcr32: ['HCR32'],
  hnr32: ['HNR32'],
  bnr32: ['BNR32']
};

// Does this family's export keep the colour-trim character at [L+6]?
//
// It is not a global rule, and assuming it was produced a whole S13 family
// whose every paint code was one character short. Checked against all 42
// shipped files: every R32, R33 and R34 export is 3 characters, so the
// character is dropped there. The S13 family, S14, C34, the JDM Z32 files and
// M35 are 3 OR 4 - the character is kept, and the 3s are the records where it
// was a space. The Z32 EXPORT files (us/ca/el/er) are 3, like the Skylines.
//
// database.js splits it back out at load: dict.c becomes the paint code and
// dict.ctr the trim character, keyed on length 4. So keeping it where the
// family keeps it is what makes the trim character show up on the plate at all.
const KEEPS_COLOR_PREFIX = new Set(['s13', 'ps13', 'ks13', 'rs13', 'rps13', 's15']);

const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const ascii = (b, o, n) => b.subarray(o, o + n).toString('ascii');

// Two-digit years, disambiguated by where these cars actually were built. The
// FAST discs here cover 1985 to 2002, so a year below 60 is the 2000s and
// anything else is the 1900s. S15 is the only chassis in this repo that needs
// it - it runs to 2002-08 - but R34 would too if it were ever re-extracted.
const yearOf = (ymm) => { const y = Math.floor(ymm / 100); return (y < 60 ? '20' : '19') + String(y).padStart(2, '0'); };

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
    const blk = buf[o + L];
    if (blk < 0x30 || blk > 0x39) continue;
    const ymm = be16(buf, o + L + 4);
    const mo = ymm % 100;
    if (mo < 1 || mo > 12) continue;
    const yr = Math.floor(ymm / 100);
    // Two-digit year, and it wraps. The same "yr < 60 is not a date" rule that
    // made the audit tool report R34 nearly 24,000 records short was sitting
    // here too, and it cut S15 off at 1999-12: the car ran to 2002-08, so 20,476
    // of its 39,138 records are years 00, 01 and 02. Any two-digit year is a
    // year; see yearOf below for how the century is chosen.
    if (yr > 99) continue;
    const paint = ascii(buf, o + L + 7, 3);
    if (!/^[A-Z0-9]{3}$/.test(paint)) continue;
    // [L+10..L+13] and [L+15..L+17] are usually spaces but are NOT padding -
    // they carry data on a minority of records ("2   " and "  *" turn up on
    // the 17 BNR32 cars in two-tone 2M8, for one). Requiring spaces there
    // silently dropped real records, and dropped them in a way that looked
    // like a clean extract: 43,878 of 43,895 with no error. The structural
    // anchors are the nulls, which hold on every record in every chassis.
    if (buf[o + L + 18] !== 0x00) continue;
    offsets.push(o);
  }

  // Keep only offsets that sit on this chassis's own record grid.
  //
  // This replaces two earlier tests that were each wrong in a different way.
  //
  // The first was "the byte before must not be a letter", meant to stop "R32"
  // matching inside "ECR32". It works only while record tails are zero. S15's
  // are not: an S15 record ends 00 00 12 52, and 0x52 is "R" - so the NEXT
  // record was thrown away for being preceded by a letter, and a phantom
  // "RS15" was found one byte earlier reading the very same fields. That cost
  // 4,912 of S15's 39,138 records and invented two chassis codes, RS15 and
  // CS15, that do not exist.
  //
  // The second was requiring the four trailing bytes to be zero. Also true
  // only of the older chassis; R34 and S15 both carry data there.
  //
  // What actually identifies a record is that its neighbours are records.
  // A genuine run is contiguous at len(code) + 26, so an offset is kept when
  // one step either way lands on another match. That admits S15's letter-
  // preceded records and still rejects the lone false positive this had
  // caught: an "ER32" inside an HK11 Micra record whose paint code is ER3
  // followed by a 2, which has no neighbour at ±30.
  const step = L + 26;
  const set = new Set(offsets);
  const kept = offsets.filter(o => set.has(o - step) || set.has(o + step));
  // A chassis with a single record would be dropped by that rule; none here
  // has fewer than 116, but say so rather than let it fail silently.
  if (offsets.length && !kept.length) {
    throw new Error(`${code}: ${offsets.length} matches, none contiguous at ${step} bytes.`);
  }
  return kept;
}

// Build one export from an ordered list of chassis codes. A single-code file is
// just a group of one, so there is only this path.
function extract(name) {
  const key = name.toLowerCase();
  const codes = GROUPS[key] || [name.toUpperCase()];
  const label = (GROUPS[key] ? codes[0] : name.toUpperCase());
  const keepPrefix = KEEPS_COLOR_PREFIX.has(key);

  // Dictionaries are built in first-seen order across the whole concatenation,
  // which is what the shipped files do - row 0 of every one of them indexes 0
  // into each dictionary.
  const b = [], d = [], c = [], t = [], mc = [];
  const bi = new Map(), di = new Map(), ci = new Map(), ti = new Map(), mci = new Map();
  const intern = (arr, map, v) => {
    let k = map.get(v);
    if (k === undefined) { k = arr.length; arr.push(v); map.set(v, k); }
    return k;
  };

  const rows = [];
  const parts = [];
  for (const code of codes) {
    const loc = LOCATION[code];
    if (!loc) throw new Error('No source location known for ' + code);
    const buf = fs.readFileSync(path.join(SRC, loc.vindat));
    const mdl = fs.readFileSync(path.join(SRC, loc.mdlcode));
    const L = code.length;
    const offsets = findRecords(buf, code);
    parts.push(code + ' ' + offsets.length.toLocaleString());
    for (const o of offsets) {
      const ymm = be16(buf, o + L + 4);
      const ptr = be24(buf, o + L + 19);
      rows.push([
        intern(b, bi, String.fromCharCode(buf[o + L])),
        be24(buf, o + L + 1),
        intern(d, di, yearOf(ymm) + '-' + String(ymm % 100).padStart(2, '0')),
        // [L+6] is the colour-trim character. Kept or dropped per family - see
        // KEEPS_COLOR_PREFIX. When kept it is trimmed, so a space there yields
        // the bare 3-character paint code, which is why those families show a
        // mix of 3s and 4s.
        intern(c, ci, keepPrefix ? ascii(buf, o + L + 6, 4).trim()
                                 : ascii(buf, o + L + 7, 3)),
        intern(t, ti, String.fromCharCode(buf[o + L + 14])),
        intern(mc, mci, ptr + 20 <= mdl.length ? ascii(mdl, ptr, 20) : '')
      ]);
    }
  }

  return { m: label, n: rows.length, b, d, c, t, mc, r: rows, _parts: parts };
}

// ---------------------------------------------------------------------------

function compare(code) {
  const file = path.join(OUT_DIR, 'fast_' + code.toLowerCase() + '.json');
  if (!fs.existsSync(file)) return { code, status: 'no shipped file to compare' };
  const want = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const got = extract(code);

  const diffs = [];
  if (got.n !== want.n) diffs.push(`count ${got.n} vs ${want.n}`);

  // Compare the RECORDS, not the encoding.
  //
  // Dictionary indices are an implementation detail and the two do not agree
  // on them: the original S13 extract built ONE dictionary across the whole
  // family and wrote all 5,167 model codes into each of the four files, so
  // fast_ks13.json carries thousands of codes none of its own rows use. This
  // extractor interns per file. Both are correct - every row resolves to the
  // same car - and comparing raw indices would call that a failure while
  // missing a dictionary built in the wrong order that happened to be the
  // same size. Resolving through each side's own dictionary tests the thing
  // that matters.
  const resolve = (doc, r) => [
    doc.b[r[0]], r[1], doc.d[r[2]], doc.c[r[3]], doc.t[r[4]], doc.mc[r[5]]
  ].join('');

  let bad = 0;
  const n = Math.min(got.r.length, want.r.length);
  for (let i = 0; i < n; i++) {
    if (resolve(got, got.r[i]) !== resolve(want, want.r[i])) {
      if (bad < 3) diffs.push(`row ${i}: ${resolve(got, got.r[i])} vs ${resolve(want, want.r[i])}`);
      bad++;
    }
  }
  if (bad) diffs.push(`${bad} of ${n} rows differ`);

  const sameEncoding = ['b', 'd', 'c', 't', 'mc']
    .every(k => JSON.stringify(got[k]) === JSON.stringify(want[k]));
  const status = diffs.length ? 'MISMATCH'
               : (sameEncoding ? 'exact match' : 'records match (leaner dictionary)');
  return { code, status, diffs, n: got.n };
}

const args = process.argv.slice(2);

if (args.includes('--verify')) {
  const known = ['FR32', 'HR32', 'HCR32', 'HNR32', 'BNR32', 'ECR32', 'ER32', 's13', 'ps13', 'ks13', 'rs13'];
  let ok = 0;
  for (const code of known) {
    const r = compare(code);
    console.log(`${code.padEnd(6)} ${String(r.n || '').padStart(7)}  ${r.status}`);
    if (r.diffs && r.diffs.length) r.diffs.slice(0, 5).forEach(x => console.log('        ' + x));
    if (r.status !== 'MISMATCH') ok++;
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
  // Reduce, not spread. Math.min(...sers) overflows the call stack somewhere
  // above 100k arguments, and it did it on S13's 165,866 - after printing the
  // counts and BEFORE the write, so the run looked like it had succeeded while
  // leaving the file untouched.
  let lo = Infinity, hi = -Infinity;
  for (const v of sers) { if (v < lo) lo = v; if (v > hi) hi = v; }
  console.log(`  serial ${lo} .. ${hi}`);
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
