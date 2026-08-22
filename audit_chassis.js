// audit_chassis.js - what does the FAST source hold that the site does not?
//
// WHY THIS EXISTS
//
// ECR32 and ER32 sat in the source unextracted for as long as this archive has
// existed, and nothing noticed until someone looked up a car and was told it
// did not exist. Nothing had ever compared the source against what shipped.
//
// The important design choice here is that it does NOT check a list of codes.
// A list only finds chassis someone already thought of, which is precisely how
// two were missed. This walks the records and reports every chassis code it
// finds, whether or not anyone expected it.
//
// HOW IT WALKS
//
// Records are fixed-width per chassis but NOT across a file: the width is
// len(code) + 26, so a 4-character code makes 30-byte records and a
// 5-character code 31-byte ones. Records for one chassis are contiguous, so
// the walker locks onto a chassis, strides through it, and re-detects when the
// stride stops validating. That is far cheaper than testing every offset.
//
// A candidate is only accepted if the whole record shape holds - block digit,
// a real YYMM date, a printable paint code, and the structural nulls. See
// extract_vindat.js for the field layout.
//
// HOW TO READ THE OUTPUT — and what it found on 2026-08-22
//
// "MISSING" is the trustworthy verdict. The walker can undercount but it does
// not invent records, so a chassis it finds in the source and cannot find on
// the site is a real gap.
//
// "COUNT DIFFERS" where the SITE HOLDS MORE is not a gap and never can be.
// It means this walker undercounted, and there are two known reasons:
//
//   1. The site groups siblings into one file. fast_ps13.json is PS13 plus
//      KPS13 (100,115 + 12,197 = 112,312 exactly) and fast_rs13.json is RS13
//      plus KRS13 (19,478 + 7,262 = 26,740 exactly), which is what
//      database.js documents. Those are complete, not short.
//   2. Genuine undercounting. R34 comes back ~24,000 light and Z32 ~300
//      light against files whose totals are known good, so the walk
//      desynchronises somewhere in those volumes. R34 and Z32 completeness is
//      therefore UNPROVEN by this tool, not disproven. Worth fixing before
//      trusting a clean bill of health for either.
//
// What it established:
//   COMPLETE, exactly     R32 (all seven), R33 (all five), S14, CS14,
//                         KS13, HZ32 — source and site agree to the record
//   REAL GAP              RPS13 (74,910) and KRPS13 (11,655) — 86,565 180SX
//                         records, the SR20-era chassis code. The site holds
//                         RS13 + KRS13 = 26,740, which is 24% of the 180SX
//                         in the source. Zero records in any loaded file
//                         carry an RPS13 code; the ten such entries in the
//                         shared dictionary are referenced by nothing.
//   OUT OF SCOPE          the Laurel C34 codes — see the note on GENS below
//
// USAGE
//   node audit_chassis.js               every chassis in every JP VINDAT file
//   node audit_chassis.js --gen R32     only codes ending in that suffix

'use strict';
const fs = require('fs');
const path = require('path');

const SRC = 'H:/AR-JP/JP';
const DATA = path.join(__dirname, 'public', 'data');

const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const be16 = (b, o) => (b[o] << 8) | b[o + 1];

// Is there a valid record at `o` whose chassis code is `L` characters long?
function validAt(buf, o, L) {
  if (o + L + 26 > buf.length) return false;
  // A chassis code is letters then digits - "S13", "ECR32", "WGC34". Requiring
  // A-Z across the whole code (the first version of this) matched nothing at
  // all, because every code ends in its generation number.
  //
  // Allowing digits raises an ambiguity: "ECR32" followed by block "0" could
  // also read as a 6-character code "ECR320". LENGTHS tries longest first, and
  // that case dies on its own - the byte after "ECR320" is the top byte of the
  // serial, almost always 0x00, which is not a block digit.
  let seenDigit = false;
  for (let k = 0; k < L; k++) {
    const ch = buf[o + k];
    const isAlpha = ch >= 65 && ch <= 90;
    const isDigit = ch >= 48 && ch <= 57;
    if (!isAlpha && !isDigit) return false;
    if (k === 0 && !isAlpha) return false;      // codes start with a letter
    if (isDigit) seenDigit = true;
    else if (seenDigit) return false;           // letters never follow digits
  }
  if (!seenDigit) return false;
  const blk = buf[o + L];
  if (blk < 0x30 || blk > 0x39) return false;
  const ymm = be16(buf, o + L + 4);
  const mo = ymm % 100, yr = Math.floor(ymm / 100);
  if (mo < 1 || mo > 12 || yr < 60 || yr > 99) return false;
  for (let k = 7; k < 10; k++) {
    const ch = buf[o + L + k];
    if (!((ch >= 65 && ch <= 90) || (ch >= 48 && ch <= 57))) return false;
  }
  if (buf[o + L + 18] !== 0) return false;
  if (be24(buf, o + L + 22) !== 0 || buf[o + L + 25] !== 0) return false;
  return true;
}

// Code length cannot be decided from one record, and this is the whole
// difficulty of the walk.
//
// A record starting at p with the 5-character code "WGC34" and a record
// starting at p+1 with the 4-character code "GC34" put every following field
// at exactly the same byte: the extra code character is paid for by the extra
// offset, so L cancels. Both validate. The first version of this walker split
// WGC34 into a mix of "WGC34" and a phantom "GC34", and did the same to WHC34
// ("HC34") and PS13 ("RPS13"), then reported the phantoms as chassis missing
// from the site. The giveaway was the site holding MORE records than the
// source appeared to contain, which cannot happen if the scan is right.
//
// What does distinguish them is the NEXT record. Records of one chassis are
// contiguous and equally spaced, so the true length is the one whose stride
// lands on another record of the same code. Requiring the chain to hold for a
// few records makes the wrong length fall away almost immediately.
const LENGTHS = [6, 5, 4, 3];
const CHAIN = 3;

function codeAt(buf, o, L) { return buf.subarray(o, o + L).toString('ascii'); }

function detect(buf, o) {
  let fallback = 0;
  for (const L of LENGTHS) {
    if (!validAt(buf, o, L)) continue;
    if (!fallback) fallback = L;          // in case nothing chains (very short runs)
    const code = codeAt(buf, o, L);
    const step = L + 26;
    let chained = 1, p = o + step;
    while (chained < CHAIN && p + L + 26 <= buf.length &&
           validAt(buf, p, L) && codeAt(buf, p, L) === code) { chained++; p += step; }
    if (chained >= CHAIN) return L;
  }
  return fallback;
}

function scan(file) {
  const buf = fs.readFileSync(path.join(SRC, file));
  const tally = new Map();
  let o = 0;
  while (o < buf.length) {
    const L = detect(buf, o);
    if (!L) { o++; continue; }
    // Locked on. Stride through this chassis while the shape keeps holding.
    const code = buf.subarray(o, o + L).toString('ascii');
    const step = L + 26;
    let n = 0;
    while (o + step <= buf.length && validAt(buf, o, L) &&
           buf.subarray(o, o + L).toString('ascii') === code) {
      n++; o += step;
    }
    tally.set(code, (tally.get(code) || 0) + n);
  }
  return tally;
}

// What the site actually loads, read from database.js so it cannot drift.
function siteCounts() {
  const src = fs.readFileSync(path.join(__dirname, 'public', 'js', 'database.js'), 'utf8');
  const m = src.match(/const prefixes = \[([\s\S]*?)\];/);
  const prefixes = [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]);
  const out = new Map();
  for (const p of prefixes) {
    const f = path.join(DATA, 'fast_' + p + '.json');
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
    out.set((d.m || p).toUpperCase(), d.r.length);
  }
  return out;
}

const genArg = (() => { const i = process.argv.indexOf('--gen'); return i >= 0 ? process.argv[i + 1].toUpperCase() : null; })();

const files = fs.readdirSync(SRC).filter(f => /^VINDAT[0-9]\.(AA|AB)[0-9]$/.test(f));
const source = new Map();
for (const f of files) {
  process.stderr.write('scanning ' + f + '\n');
  for (const [code, n] of scan(f)) source.set(code, (source.get(code) || 0) + n);
}

const site = siteCounts();

// Only the generations this site is about. A chassis from some unrelated model
// is not a gap, it is out of scope.
//
// "C34" needs the W. The C34 platform carries the Stagea (WGC34, WGNC34,
// WHC34) AND the Laurel (GC34, GCC34, GNC34, HC34, SC34), and matching on the
// suffix alone reported 173,409 Laurel records as chassis missing from a site
// that has never claimed to cover the Laurel. Their model codes confirm it —
// "GHARFNC34EDA-----C34" against the Stagea's own — and they start 1992-07,
// ahead of the Laurel's January 1993 launch.
const GENS = ['R32', 'R33', 'R34', 'S13', 'S14', 'Z32'];
const inScope = (code) =>
  GENS.some(g => code.endsWith(g)) ||
  (code.endsWith('C34') && code.startsWith('W')) ||
  (genArg && code.endsWith(genArg));

const rows = [...source.entries()]
  .filter(([code, n]) => n >= 100 && (genArg ? code.endsWith(genArg) : inScope(code)))
  .sort((a, b) => (a[0].slice(-3) + a[0]).localeCompare(b[0].slice(-3) + b[0]));

console.log('');
console.log('chassis   in source     on site   status');
console.log('-------   ---------   ---------   ------');
let missing = 0, mismatch = 0;
for (const [code, n] of rows) {
  const have = site.get(code);
  let status;
  if (have === undefined) { status = 'MISSING from the site'; missing++; }
  else if (have !== n) { status = 'COUNT DIFFERS (' + (have - n > 0 ? '+' : '') + (have - n) + ')'; mismatch++; }
  else status = 'ok';
  console.log(code.padEnd(9), String(n).padStart(9), String(have === undefined ? '-' : have).padStart(11), '  ' + status);
}
console.log('');
console.log(`${rows.length} in-scope chassis in the source: ${rows.length - missing - mismatch} match, ${missing} missing, ${mismatch} differing.`);

// Anything the site loads that the scan did not see at all is worth knowing
// about too - it would mean the walker is wrong, not that the data is.
const unseen = [...site.keys()].filter(k => !source.has(k) && !/_/.test(k));
if (unseen.length) console.log('\nOn the site but not found by this scan (check the walker): ' + unseen.join(', '));
