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
// WHAT IT FOUND, and where it stands as of 2026-08-22
//
// Final state: 35 in-scope chassis in the source, 35 accounted for on the
// site, 0 missing, 0 differing.
//
// The most expensive lesson is in that number changing from 34 to 35. GENS
// listed the generations the site already had, so the audit could only ever
// answer "is what we have complete". A whole generation that had never been
// added - the S15 Silvia, 39,138 records - could not show up as absent,
// because nothing was looking for it. It surfaced only when someone asked for
// it by name. An audit scoped to what you already know finds omissions, not
// blind spots.
//
// Getting there took three corrections to this tool, and every one of them
// had first been reported as a fault in the DATA:
//
//   1. Phantom chassis. "GC34" and "HC34" were reported missing; they are the
//      Laurel, which shares the C34 platform with the Stagea and which this
//      site has never covered. Matching a suffix is not matching a model.
//   2. R34 "missing" ~24,000 records. The year is two digits and R34 runs into
//      2000-2002, stored as 00, 01, 02; a "yr < 60 is not a date" rule threw
//      all of it away. Another 358 went to a required-zero tail that R34 does
//      not have. The site had been right about R34 the whole time.
//   3. Six chassis reported missing or short that were neither. Some shipped
//      files hold more than one code — see FOLDED_INTO — and the tool now
//      checks that arithmetic instead of crying wolf on it.
//   4. Two chassis codes that do not exist. RS15 and CS15 looked real - 2,581
//      and 116 records passing every shape test - and were neither. They are
//      S15 records whose preceding byte happens to be R or C, matched one
//      byte early, reading the identical fields because the extra code
//      character cancels against the extra offset. The contiguity rule kills
//      them: their gaps are multiples of 29, S15 stride, not their own 30.
//
// The one REAL gap it found, and which is now closed: RPS13 (74,910) and
// KRPS13 (11,655), the SR20-era 180SX. 86,565 records the site had never
// held, while presenting RS13's 26,740 — 24% of the 180SX in the source —
// as the 180SX.
//
// The lesson worth keeping: when this tool and the site disagree, the tool is
// the more likely to be wrong. It said "unproven, not disproven" about R34 and
// Z32 rather than declaring a gap, and that was the correct call — both were
// complete. A site holding MORE records than the source appears to contain is
// always this tool undercounting, because a walk cannot invent records.
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
  // The year is two digits and it wraps. R34 production runs into 2000-2002,
  // stored as 00, 01, 02 - and a "yr < 60 means not a date" rule threw all of
  // it away. That single line was most of why this tool reported R34 nearly
  // 24,000 records short and called its completeness unproven; the site had
  // been right all along. Any two-digit year is a year.
  if (mo < 1 || mo > 12 || yr > 99) return false;
  for (let k = 7; k < 10; k++) {
    const ch = buf[o + L + k];
    if (!((ch >= 65 && ch <= 90) || (ch >= 48 && ch <= 57))) return false;
  }
  // [L+18] is null on every record of every chassis and is the reliable anchor.
  //
  // The four bytes at [L+22] are NOT. They are zero on the older chassis, which
  // made them look structural, but R34 records carry data there - the trailing
  // bytes of a BNR34 record read 00 00 d6 cb. Requiring zeros discarded another
  // 358 real records. The contiguity requirement in the walk below is what
  // actually rejects false matches, so this check is not needed for that.
  if (buf[o + L + 18] !== 0) return false;
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
// S15 was NOT in this list, and that is exactly how a whole generation went
// missing: the audit answers 'is what we have complete', and a generation
// never added cannot show up as absent from it. 39,138 records sat in
// VINDAT3.AB3 unnoticed until someone asked for them by name. Any generation
// the discs cover belongs here, whether or not the site has it yet.
const GENS = ['R32', 'R33', 'R34', 'S13', 'S14', 'S15', 'Z32'];
const inScope = (code) =>
  GENS.some(g => code.endsWith(g)) ||
  (code.endsWith('C34') && code.startsWith('W')) ||
  (genArg && code.endsWith(genArg));

// Some shipped files hold more than one chassis code, so a code with no file
// of its own is not necessarily absent - it may be folded into a sibling's.
// Without this the tool cries wolf on six chassis that are all present and
// correct, which is exactly the noise that makes an audit stop being read.
const FOLDED_INTO = { KPS13: 'PS13', KRS13: 'RS13', KRPS13: 'RPS13' };

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
  if (have === undefined && FOLDED_INTO[code]) {
    // Present, just not in a file of its own. Confirm the arithmetic rather
    // than take it on trust: the host file must hold its own count plus this.
    const host = FOLDED_INTO[code];
    const hostHas = site.get(host), hostSrc = source.get(host);
    const ok = hostHas !== undefined && hostSrc !== undefined && hostHas === hostSrc + n;
    status = ok ? `ok (inside fast_${host.toLowerCase()}.json)`
                : `CHECK: expected fast_${host.toLowerCase()}.json to hold ${(hostSrc || 0) + n}, holds ${hostHas}`;
    if (!ok) mismatch++;
  } else if (have === undefined) { status = 'MISSING from the site'; missing++; }
  else if (have !== n) {
    const folded = Object.entries(FOLDED_INTO).filter(([, host]) => host === code).map(([k]) => k);
    const expect = n + folded.reduce((s, k) => s + (source.get(k) || 0), 0);
    status = (folded.length && have === expect)
      ? `ok (+ ${folded.join(', ')})`
      : 'COUNT DIFFERS (' + (have - n > 0 ? '+' : '') + (have - n) + ')';
    if (!status.startsWith('ok')) mismatch++;
  } else status = 'ok';
  console.log(code.padEnd(9), String(n).padStart(9), String(have === undefined ? '-' : have).padStart(11), '  ' + status);
}
console.log('');
console.log(`${rows.length} in-scope chassis in the source: ${rows.length - missing - mismatch} accounted for, ${missing} missing, ${mismatch} differing.`);

// Anything the site loads that the scan did not see at all is worth knowing
// about too - it would mean the walker is wrong, not that the data is.
const unseen = [...site.keys()].filter(k => !source.has(k) && !/_/.test(k));
if (unseen.length) console.log('\nOn the site but not found by this scan (check the walker): ' + unseen.join(', '));
