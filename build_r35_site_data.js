// build_r35_site_data.js - turn the two raw R35 extraction files into the
// columnar schema public/js/database.js's loader consumes, WITHOUT touching the
// raw sources (they stay the provenance record).
//
//   fast_r35_export.json (extract_r35_export.js, 16,351 export cars, VIN-keyed)
//       -> fast_r35export.json   (loader prefix 'r35export', col.vin path)
//   fast_r35_ext.json    (japancats.ru harvest, 1,962 JDM cars 2013-2016)
//       -> fast_r35ext.json      (loader prefix 'r35ext', standard chassis path)
//
// Both are emitted already sorted by (block, serial) so the loader's
// _ensureSortedByChassis is a no-op and never has to permute the extra parallel
// arrays (grade/sourceInfo) this schema adds.
//
//   node build_r35_site_data.js
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'public', 'data');

// --- ISO-3779 VIN check digit, to mark which export VINs are publicly ---------
// verifiable (US/CA 17-char VINs pass; Europe's non-standard ones do not).
const TRANS = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,
  S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9 };
const WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
function vinValid(vin) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (TRANS[vin[i]] ?? 0) * WEIGHTS[i];
  const chk = sum % 11;
  const want = chk === 10 ? 'X' : String(chk);
  return vin[8] === want;
}

const dictBuilder = () => {
  const arr = [], idx = new Map();
  return { arr, fn: v => { if (!idx.has(v)) { idx.set(v, arr.length); arr.push(v); } return idx.get(v); } };
};

// ---------------------------------------------------------------------------
// 1) EXPORT -> fast_r35export.json
// ---------------------------------------------------------------------------
function buildExport() {
  const src = JSON.parse(fs.readFileSync(path.join(DIR, 'fast_r35_export.json'), 'utf8'));
  const REGION_NAME = {
    US: 'United States', CA: 'Canada', EL: 'Europe (LHD)',
    ER: 'Europe (RHD, incl. GB / South Africa)', GL: 'General Markets (LHD)',
    GR: 'General Markets (RHD)', AR: 'Australia / New Zealand / India'
  };
  // one row per car: [regionIdx, destIdx, vin, date, colourIdx, mcIdx]
  const rows = src.r.map(r => ({
    region: src.region[r[0]], dest: src.dest[r[1]], vin: r[2],
    date: r[3], colour: src.c[r[4]], mc: src.mc[r[5]]
  }));
  // Stable display order: region, then destination, then VIN.
  rows.sort((a, b) => a.region.localeCompare(b.region) || a.dest.localeCompare(b.dest) || a.vin.localeCompare(b.vin));

  const d = dictBuilder(), c = dictBuilder(), mc = dictBuilder();
  const srcInfoIdx = new Map(), sourceInfo = [];
  const vin = [], rowSource = [], out = [];
  rows.forEach((row, i) => {
    const confirmed = vinValid(row.vin);
    const destLabel = `${REGION_NAME[row.region] || row.region} — ${row.dest}`;
    const key = destLabel + '|' + confirmed;
    if (!srcInfoIdx.has(key)) { srcInfoIdx.set(key, sourceInfo.length); sourceInfo.push({ destination: destLabel, confirmed }); }
    rowSource.push(srcInfoIdx.get(key));
    vin.push(row.vin);
    // [block=0, serial=i (keeps it pre-sorted), dateIdx, colourIdx, trimIdx=0, mcIdx]
    out.push([0, i, d.fn(row.date), c.fn(row.colour), 0, mc.fn(row.mc)]);
  });

  const doc = {
    m: 'R35_EXPORT',
    source: src.source,
    n: out.length,
    b: ['0'], d: d.arr, c: c.arr, t: [''], mc: mc.arr,
    vin, sourceInfo, rowSource,
    r: out
  };
  const file = path.join(DIR, 'fast_r35export.json');
  fs.writeFileSync(file, JSON.stringify(doc) + '\n', 'utf8');
  const conf = rowSource.filter((s) => sourceInfo[s].confirmed).length;
  console.log(`fast_r35export.json  ${out.length} cars, ${sourceInfo.length} dest/confirm groups, ${conf} check-digit-valid VINs, ${(fs.statSync(file).size/1048576).toFixed(2)} MB`);
}

// ---------------------------------------------------------------------------
// 2) JAPANCATS -> fast_r35ext.json  (JDM chassis path, pre-decoded grade)
// ---------------------------------------------------------------------------
function buildExt() {
  const src = JSON.parse(fs.readFileSync(path.join(DIR, 'fast_r35_ext.json'), 'utf8'));
  const rows = src.r.slice().sort((a, b) => a.serial - b.serial); // single block, already asc
  const d = dictBuilder(), c = dictBuilder();
  const grade = [], out = [];
  for (const row of rows) {
    const colourTrim = (row.interior || '') + (row.paint || ''); // e.g. G + GAG -> GGAG
    grade.push(row.gradeName || '');
    out.push([0, row.serial, d.fn(row.date), c.fn(colourTrim), 0, 0]);
  }
  const doc = {
    m: 'R35_EXT',
    source: src.source,
    n: out.length,
    b: ['0'], d: d.arr, c: c.arr, t: [''], mc: [''],
    grade,
    provenance: {
      status: '✅ FAST Record (external catalogue)',
      note: 'From the japancats.ru FAST catalogue (a second, later Nissan FAST snapshot) - the post-disc R35 cars beyond this archive\'s own 2013 disc. Cross-checked byte-for-byte against our disc on the 202-car overlap, every field agreeing.'
    },
    r: out
  };
  const file = path.join(DIR, 'fast_r35ext.json');
  fs.writeFileSync(file, JSON.stringify(doc) + '\n', 'utf8');
  console.log(`fast_r35ext.json     ${out.length} cars, dates ${rows[0].date}..${rows[rows.length-1].date}, ${(fs.statSync(file).size/1024).toFixed(0)} KB`);
}

buildExport();
buildExt();
