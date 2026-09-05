// ingest_r35_amayama.js - check a frame-search export against fast_r35.json
// and write the post-disc cars as a separate, honestly-labelled file.
//
// WHY A SEPARATE FILE
//
// fast_r35.json is the 2013-02 FAST disc: 8,046 cars, each with the 20-byte
// factory model code that every decoder on the site keys off. The frame
// search returns the same underlying record but exposes only five fields of
// it - specification period, grade, manufacturing month, interior letter,
// paint code - and no model code, no options, no block/serial beyond what we
// typed in. Those cars cannot be rows of the same shape, so they are not
// pretended to be: they go to fast_r35_ext.json with their own schema and a
// `source` field, and nothing here touches fast_r35.json.
//
// WHY THE OVERLAP CHECK IS THE POINT
//
// The scrape starts at block 0 serial 50,203, one past the disc, so it should
// not overlap at all - but the probes of blocks 1/3/4 do, and any run that is
// resumed or re-ranged might. Every hit whose (block, serial) exists in
// fast_r35.json is compared on all four fields the two sources share. One
// disagreement is a bug in the reader; the two sources are the same database.
//
// USAGE
//   node ingest_r35_amayama.js <path-to-r35-amayama-scrape.json> [--write]
'use strict';
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('usage: node ingest_r35_amayama.js <scrape.json> [--write]'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'fast_r35.json'), 'utf8').replace(/^﻿/, ''));
const scrape = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
const hits = scrape.hits || scrape;

// Amayama's grade abbreviations against the model-code letter this archive
// already decodes. NISMO and NPKG have no letter yet - the frame search does
// not expose the model code - so they carry the abbreviation and no letter.
const GRADE = {
  PREMIUM: { letter: 'Y', name: 'GT-R Premium Edition' },
  BLACK:   { letter: 'R', name: 'GT-R Black Edition' },
  GTR:     { letter: 'W', name: 'GT-R' },
  PURE:    { letter: 'W', name: 'GT-R Pure Edition' },
  SPECV:   { letter: 'M', name: 'SPEC-V' },
  EGOIST:  { letter: 'V', name: 'EGOIST' },
  NISMO:   { letter: null, name: 'GT-R NISMO' },
  NPKG:    { letter: null, name: 'Track edition engineered by NISMO' }
};

// index the disc by block|serial
const disc = new Map();
for (const r of doc.r) {
  disc.set(doc.b[r[0]] + '|' + r[1], {
    date: doc.d[r[2]], colour: doc.c[r[3]], mc: doc.mc[r[5]], grade: doc.mc[r[5]][4]
  });
}

let overlap = 0, agree = 0, disagree = 0, unknownGrade = new Map(), badShape = 0;
const ext = [];
const seen = new Set();
const madeToIso = (m) => { const [mm, yyyy] = m.split('.'); return `${yyyy}-${mm}`; };
for (const h of hits) {
  if (!h || !/^R35-\d{6}$/.test(h.fr || '')) { badShape++; continue; }
  const blk = h.fr[4], serial = parseInt(h.fr.slice(5), 10);
  const key = blk + '|' + serial;
  if (seen.has(key)) continue;
  seen.add(key);
  const g = GRADE[h.grade];
  if (!g) unknownGrade.set(h.grade, (unknownGrade.get(h.grade) || 0) + 1);
  const rec = {
    block: blk, serial, date: madeToIso(h.made), interior: h.trim, paint: h.color,
    grade: h.grade, gradeName: g ? g.name : null, gradeLetter: g ? g.letter : null,
    period: h.period
  };
  const d = disc.get(key);
  if (d) {
    overlap++;
    const ok = d.date === rec.date && d.colour === rec.interior + rec.paint && (!g || !g.letter || d.grade === g.letter);
    if (ok) agree++;
    else { disagree++; if (disagree <= 10) console.log('DISAGREE', h.fr, 'disc', d, 'scrape', rec); }
    continue;                                   // already held; the disc row is authoritative
  }
  ext.push(rec);
}
ext.sort((a, b) => a.block === b.block ? a.serial - b.serial : a.block.localeCompare(b.block));

const dates = ext.map(r => r.date).sort();
const byGrade = {}; for (const r of ext) byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
const byYear = {}; for (const r of ext) byYear[r.date.slice(0, 4)] = (byYear[r.date.slice(0, 4)] || 0) + 1;
console.log(`hits ${hits.length}  unique ${seen.size}  bad shape ${badShape}`);
console.log(`overlap with disc ${overlap}: agree ${agree}, disagree ${disagree}`);
console.log(`new cars ${ext.length}  dates ${dates[0]} .. ${dates[dates.length - 1]}`);
console.log('by grade', byGrade);
console.log('by year', byYear);
if (unknownGrade.size) console.log('UNKNOWN grade abbreviations', [...unknownGrade.entries()]);

if (disagree) { console.error('refusing to write: the two sources disagree on cars they both hold'); process.exit(1); }
if (process.argv.includes('--write')) {
  const out = {
    m: 'R35', source: 'Amayama frame search (nissan-japan), a live copy of Nissan FAST',
    scraped: scrape.exported || null, n: ext.length,
    fields: ['block', 'serial', 'date', 'interior', 'paint', 'grade', 'gradeName', 'gradeLetter', 'period'],
    r: ext
  };
  const file = path.join(__dirname, 'public', 'data', 'fast_r35_ext.json');
  fs.writeFileSync(file, JSON.stringify(out) + '\n', 'utf8');
  console.log(`wrote ${path.relative(__dirname, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
} else {
  console.log('(dry run - pass --write to save public/data/fast_r35_ext.json)');
}
