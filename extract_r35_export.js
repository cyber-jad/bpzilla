// extract_r35_export.js - the export-market R35 GT-R, every region.
//
// The JDM R35 came from H:\AR-JP\JP (extract_vindat.js). The EXPORT R35 sits
// unextracted in H:\NISSAN\<region>, in a different, VIN-indexed format:
// VINDAT8 files, fixed 37-byte records, one per car built for export, keyed
// on the 17-char VIN rather than a JDM frame number. Seven regions:
//
//   US  United States        CA  Canada
//   EL  Europe LHD           ER  Europe RHD (incl. GB, South Africa)
//   GL  General LHD          GR  General RHD
//   AR  Australia/NZ/India (in the AR-JP volume set)
//
// RECORD FORMAT (37 bytes, worked out against H:\NISSAN\US\VINDAT8.GA1 and
// verified by resolving every model code):
//
//   [0..11]   VIN, first 12 chars      "JN1AR54F09M2"  (WMI+VDS+…+plant+pos12)
//   [12..14]  serial, 24-bit BE        VIN positions 13-17
//   [15..16]  build date, 16-bit BE    YYMM, e.g. 0x02C5 = 709 = 2007-09
//   [17]      colour-trim character    (kept, exactly as the JDM export keeps it)
//   [18..20]  paint code, 3 chars      "KAC"
//   [21]      space
//   [22..25]  destination code, 4 ch   "USEM","CANM","EGBM"(GB),"ASRM"(Aus)…
//   [26..28]  spaces
//   [29]      0x00
//   [30..32]  pointer, 24-bit BE, into MDLCODE.<vol> where the 20-char export
//             model code lives    "LRNLWGR35ZUA----AR35"  (L = LHD; JDM was R)
//   [33..36]  four trailing bytes (unidentified, as in the JDM tail)
//
// A record is a GT-R iff the model code at its pointer contains "GR35". That
// is the definitive test, region-independent, and it is what this uses - not a
// VIN-prefix guess. Checked on ER: the model-code test and a VIN-marker
// pre-filter agree exactly (2,509 = 2,509, zero missed, zero false).
//
// USAGE
//   node extract_r35_export.js            write public/data/fast_r35_export.json
//   node extract_r35_export.js --dry      report only, write nothing
'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'data');
const REC = 37;
const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const ascii = (b, o, n) => b.subarray(o, o + n).toString('latin1');
const yearOf = (ymm) => '20' + String(Math.floor(ymm / 100)).padStart(2, '0'); // export runs 2007-2013

// Sourced from I:\Nissan_02.19 (a later, Feb-2019 pressing of the export FAST)
// for the six regions it carries - it is a strict superset of the H:\NISSAN
// pressing for the same 2007-2013 era (US 9,124 vs 8,485, every H: car present
// plus more; ~+369 cars net across all regions), so it is the fuller source.
// It has no Australia/NZ/India folder, so AR stays on the H:\AR-JP pressing.
const REGIONS = [
  { region: 'US', vindat: 'I:/Nissan_02.19/US/VINDAT8.GA1', mdlcode: 'I:/Nissan_02.19/US/MDLCODE.GA1' },
  { region: 'CA', vindat: 'I:/Nissan_02.19/CA/VINDAT8.HA1', mdlcode: 'I:/Nissan_02.19/CA/MDLCODE.HA1' },
  { region: 'EL', vindat: 'I:/Nissan_02.19/EL/VINDAT8.BA2', mdlcode: 'I:/Nissan_02.19/EL/MDLCODE.BA2' },
  { region: 'ER', vindat: 'I:/Nissan_02.19/ER/VINDAT8.CA1', mdlcode: 'I:/Nissan_02.19/ER/MDLCODE.CA1' },
  { region: 'GL', vindat: 'I:/Nissan_02.19/GL/VINDAT8.DA2', mdlcode: 'I:/Nissan_02.19/GL/MDLCODE.DA2' },
  { region: 'GR', vindat: 'I:/Nissan_02.19/GR/VINDAT8.EA1', mdlcode: 'I:/Nissan_02.19/GR/MDLCODE.EA1' },
  { region: 'AR', vindat: 'H:/AR-JP/AR/VINDAT8.IA1', mdlcode: 'H:/AR-JP/AR/MDLCODE.IA1' }
];

function extractRegion(r) {
  const vin = fs.readFileSync(r.vindat);
  const mdl = fs.readFileSync(r.mdlcode);
  if (vin.length % REC !== 0) throw new Error(`${r.region}: VINDAT8 not a ${REC}-byte grid (${vin.length})`);
  const rows = [];
  for (let o = 0; o + REC <= vin.length; o += REC) {
    const ptr = be24(vin, o + 30);
    if (ptr + 20 > mdl.length) continue;
    const mc = ascii(mdl, ptr, 20);
    if (!mc.includes('GR35')) continue;               // the GT-R test
    const prefix = ascii(vin, o, 12);
    const serial = be24(vin, o + 12);
    const ymm = be16(vin, o + 15);
    if (ymm < 1 || ymm % 100 < 1 || ymm % 100 > 12) continue; // guard a bad date
    const colourTrim = ascii(vin, o + 17, 4).trim();  // colour char + 3-char paint, JDM-style
    const dest = ascii(vin, o + 22, 4).trim();
    // Full 17-char VIN = the 12-char prefix + the 5-digit serial (VIN pos 13-17).
    const vinFull = prefix + String(serial).padStart(5, '0');
    rows.push({
      region: r.region,
      dest,
      vin: vinFull,
      date: yearOf(ymm) + '-' + String(ymm % 100).padStart(2, '0'),
      colour: colourTrim,
      mc: mc.trim()
    });
  }
  return rows;
}

const all = [];
const perRegion = {};
for (const r of REGIONS) {
  let rows;
  try { rows = extractRegion(r); }
  catch (e) { console.error(r.region, 'FAILED:', e.message); continue; }
  perRegion[r.region] = rows.length;
  all.push(...rows);
  const dates = rows.map(x => x.date).sort();
  console.log(`${r.region}  ${String(rows.length).padStart(5)}  ${dates[0]} .. ${dates[dates.length - 1]}`);
}

// tallies for the report
const byDest = {}, byYear = {};
for (const x of all) { byDest[x.dest] = (byDest[x.dest] || 0) + 1; byYear[x.date.slice(0, 4)] = (byYear[x.date.slice(0, 4)] || 0) + 1; }
console.log('\ntotal export GT-R:', all.length);
console.log('by region:', JSON.stringify(perRegion));
console.log('by year:', JSON.stringify(byYear));
console.log('destinations:', Object.keys(byDest).length, JSON.stringify(Object.entries(byDest).sort((a, b) => b[1] - a[1]).slice(0, 12)));

if (!process.argv.includes('--dry')) {
  // dictionary-compress like the JDM files: region, dest, colour, mc as dicts.
  const dict = (key) => { const arr = [], idx = new Map(); const fn = (v) => { if (!idx.has(v)) { idx.set(v, arr.length); arr.push(v); } return idx.get(v); }; return { arr, fn }; };
  const R = dict(), D = dict(), C = dict(), M = dict();
  const rows = all.map(x => [R.fn(x.region), D.fn(x.dest), x.vin, x.date, C.fn(x.colour), M.fn(x.mc)]);
  const out = {
    m: 'R35_EXPORT',
    source: 'I:\\Nissan_02.19\\<region>\\VINDAT8 (later Feb-2019 export FAST pressing; AR from H:\\AR-JP) - export markets, all regions, 2007-2013',
    n: rows.length,
    regions: perRegion,
    cols: ['regionIdx', 'destIdx', 'vin', 'date', 'colourIdx', 'mcIdx'],
    region: R.arr, dest: D.arr, c: C.arr, mc: M.arr,
    r: rows
  };
  const file = path.join(OUT_DIR, 'fast_r35_export.json');
  fs.writeFileSync(file, JSON.stringify(out) + '\n', 'utf8');
  console.log(`\nwrote ${path.relative(__dirname, file)} (${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB)`);
}
