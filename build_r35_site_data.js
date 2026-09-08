// build_r35_site_data.js - merge the three R35 sources into ONE columnar file
// the site loads as a single "R35 GT-R" bucket (public/data/fast_r35all.json).
//
// Sources (all left untouched as provenance):
//   public/data/fast_r35.json        JDM disc, 8,046 cars   (extract_vindat.js)
//   public/data/fast_r35_export.json export markets, 17,315 (extract_r35_export.js)
//   public/data/fast_r35_ext.json    japancats 2013-2016, 1,962
//
// One column, 27,323 rows. Per-row heterogeneity is carried in parallel arrays
// the loader already understands: `vin` (export rows only, '' elsewhere),
// `grade` (japancats' pre-decoded grade, '' where the model code decodes it),
// and `sourceInfo`/`rowSource` (export destination). Export rows sit in block
// 'E' so a chassis-number search never collides with the JDM/japancats serials
// (they are found by VIN instead); everything is pre-sorted by (block, serial)
// so the loader never has to permute the parallel arrays.
//
//   node build_r35_site_data.js
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'public', 'data');
const readJSON = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

// --- ISO-3779 VIN check digit (US/CA 17-char VINs pass; Europe's don't) -------
const TRANS = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,
  S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9 };
const WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
function vinValid(vin) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (TRANS[vin[i]] ?? 0) * WEIGHTS[i];
  return vin[8] === (sum % 11 === 10 ? 'X' : String(sum % 11));
}

const REGION_NAME = {
  US: 'United States', CA: 'Canada', EL: 'Europe (LHD)',
  ER: 'Europe (RHD, incl. GB / South Africa)', GL: 'General Markets (LHD)',
  GR: 'General Markets (RHD)', AR: 'Australia / New Zealand / India'
};

// Normalise every source into a common row: { block, serial, date, colour
// (4-char interior+paint), t (the extra JDM trim constant, '' elsewhere), mc,
// vin, grade, dest }.
function normalized() {
  const rows = [];

  // JDM disc
  const j = readJSON('fast_r35.json');
  for (const r of j.r) {
    rows.push({
      block: j.b[r[0]] || '0', serial: r[1], date: j.d[r[2]] || '',
      colour: j.c[r[3]] || '', t: j.t[r[4]] || '', mc: j.mc[r[5]] || '',
      vin: '', grade: '', dest: null
    });
  }

  // export markets - block 'E', sequential serial, real VIN
  const e = readJSON('fast_r35_export.json');
  let se = 0;
  for (const r of e.r) {
    const region = e.region[r[0]], destCode = e.dest[r[1]], vin = r[2];
    rows.push({
      block: 'E', serial: se++, date: r[3], colour: e.c[r[4]] || '', t: '',
      mc: e.mc[r[5]] || '', vin,
      grade: '',
      dest: { label: `${REGION_NAME[region] || region} — ${destCode}`, confirmed: vinValid(vin) }
    });
  }

  // japancats post-disc - JDM chassis scheme (block '0', serials 50203+).
  // Normalise its grade labels to the disc's own vocabulary so the merged
  // bucket has one grade name per grade (not "Black Edition" AND "GT-R Black
  // Edition"). NISMO and Track are new - the disc never had them.
  const GRADE = {
    'GT-R Premium Edition': 'Premium', 'GT-R Black Edition': 'Black Edition',
    'GT-R Pure Edition': 'Pure Edition', 'GT-R NISMO': 'NISMO',
    'Track edition engineered by NISMO': 'Track Edition'
  };
  const x = readJSON('fast_r35_ext.json');
  for (const r of x.r) {
    rows.push({
      block: String(r.block || '0'), serial: r.serial,
      date: r.date, colour: (r.interior || '') + (r.paint || ''), t: '',
      mc: '', vin: '', grade: GRADE[r.gradeName] || r.gradeName || '', dest: null
    });
  }

  return rows;
}

const rows = normalized();
// Pre-sort by (block, serial) so the loader's _ensureSortedByChassis is a no-op.
rows.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : a.serial - b.serial));

// Dictionaries + parallel arrays.
const dict = () => { const arr = [], idx = new Map(); return { arr, fn: v => { if (!idx.has(v)) { idx.set(v, arr.length); arr.push(v); } return idx.get(v); } }; };
const B = dict(), D = dict(), C = dict(), T = dict(), M = dict();
const srcIdx = new Map(), sourceInfo = [];
const vin = [], grade = [], rowSource = [], out = [];

for (const r of rows) {
  vin.push(r.vin);
  grade.push(r.grade);
  if (r.dest) {
    const key = r.dest.label + '|' + r.dest.confirmed;
    if (!srcIdx.has(key)) { srcIdx.set(key, sourceInfo.length); sourceInfo.push({ destination: r.dest.label, confirmed: r.dest.confirmed }); }
    rowSource.push(srcIdx.get(key));
  } else {
    rowSource.push(0);
  }
  out.push([B.fn(r.block), r.serial, D.fn(r.date), C.fn(r.colour), T.fn(r.t), M.fn(r.mc)]);
}

const doc = {
  m: 'R35',
  source: 'Merged: JDM disc (fast_r35.json) + export markets (fast_r35_export.json) + japancats 2013-2016 (fast_r35_ext.json)',
  n: out.length,
  b: B.arr, d: D.arr, c: C.arr, t: T.arr, mc: M.arr,
  vin, grade, sourceInfo, rowSource,
  provenance: {
    status: '✅ FAST Record (external catalogue)',
    note: 'From the japancats.ru FAST catalogue (a second, later Nissan FAST snapshot) - the post-disc R35 cars beyond this archive\'s own 2013 disc. Cross-checked byte-for-byte against our disc on the 202-car overlap, every field agreeing.'
  },
  r: out
};
const file = path.join(DIR, 'fast_r35all.json');
fs.writeFileSync(file, JSON.stringify(doc) + '\n', 'utf8');

const nExport = vin.filter(Boolean).length;
const nExt = grade.filter(Boolean).length;
console.log(`fast_r35all.json  ${out.length} R35 cars total`);
console.log(`  JDM disc ${out.length - nExport - nExt}  |  export ${nExport}  |  japancats ${nExt}`);
console.log(`  ${sourceInfo.length} export dest/confirm groups, ${(fs.statSync(file).size / 1048576).toFixed(2)} MB`);
