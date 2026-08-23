// extract_z32_packs.js - read the Z32 パック記号 tables for windows 2 to 5.
//
// Volume 132's front matter carries five pack windows. The first, [8907-9309]
// on pages 5-6, was already read and covers 56,518 of the 64,866 JDM Z32
// records. The other four were not, so 8,348 records - every Z32 built from
// September 1993 on - decoded their pack code to nothing at all. Worse than
// nothing, in fact: with no pack table for those dates the decoder never split
// the two-character code off the tail, so "Z32JAHE7" read its E and 7 as two
// unrecognised VS characters instead of one pack code E7.
//
//   page  7   その6  [9309-9410]   W2, by 車型タイプ, plus a 首都圏限定車 pair
//   page  8   その7  [9410-9701]   W3, codes 21-61
//   page  9   その8  [9410-9701]   W3, codes 62-88
//   page 10   その9  [9701-9810]   W4
//   page 11   その10 [9810-    ]   W5, codes 70-96
//   page 12   その11 [9810-    ]   W5, codes 97-G8
//
// METHOD, and the division of labour that makes it trustworthy
//
// The row labels and column codes below were read by eye, because they are
// large text and unambiguous. The MARKS were not: fast_matrix.js finds them,
// because a circle is about 12px across on a 1280px page and a table here runs
// 19 rows by 29 codes, and misreading one cell ships a wrong fact about a car.
//
// The transcription is checked against the machine before either is trusted:
// every page's grid dimensions must equal 1 + rows by 1 + codes, or this
// refuses to write. Page 7 came back 7x22 against 3 header rows + 4 data rows
// and 21 codes; page 8 20x30 against 19 and 29; and so on for all six.
//
// USAGE
//   node extract_z32_packs.js            print the tables
//   node extract_z32_packs.js --write    write docs/wip/z32-packs.json

'use strict';
const fs = require('fs');
const path = require('path');
const { readMarks } = require('./fast_matrix.js');

const SRC = 'H:/AR-JP/JP/132';
const REC = 54;

// ---- what the pages say, read by eye ---------------------------------------

const SPOILER = 'rear spoiler';
const KEYLESS = 'keyless entry';
const CD      = 'CD player';

// Page 7. Columns are grouped by 車型タイプ and, unlike the [8907-9309] tables,
// the transmission header spans MT and AT together - so a code here means the
// same thing on both, and only the body type keys it.
const P7 = {
  page: 7, headerRows: 3,
  rows: [SPOILER, KEYLESS, CD, 'fender mirrors'],
  groups: [
    { key: 'NT',   codes: ['11','12','13','14','15','16','17','18','91'] },
    { key: 'TT',   codes: ['11','12','13','14','15','16','17','18','92'] },
    { key: 'CONV', codes: ['16','17','97'] }
  ]
};

// Pages 8 and 9 share one row vocabulary; page 9 simply stops before the two
// バージョンS rows.
const P8_ROWS = [
  // オーディオレス is "audio-less" - the row IS the deletion, so it reads as a
  // state rather than taking a "deleted" suffix. Several codes tick both this
  // and a delete-option on 電制オーディオ, which is the table saying the same
  // thing twice; that redundancy is the document's and is left alone.
  'no audio', 'electronic audio', 'BOSE audio', CD,
  'manual air conditioning', 'automatic air conditioning',
  'cruise control (ASCD, automatic only)', 'BBS wheels', SPOILER,
  'driver power seat', 'driver and passenger power seats',
  'cloth seats', 'sports seats', 'Recaro seats',
  'mirror-coat T-bar roof', 'multi remote entry system',
  'new cross-linked fluorine paint', 'Version S', 'Version S with Recaro seats'
];

const P8 = {
  page: 8, headerRows: 1, rows: P8_ROWS,
  groups: [{ key: '', codes: [
    '21','22','23','24','25','26','31','32','33','34','35','36','37','38','39',
    '41','42','43','44','45','46','47','48','53','54','55','56','58','61'
  ] }]
};

const P9 = {
  page: 9, headerRows: 1, rows: P8_ROWS.slice(0, 17),
  groups: [{ key: '', codes: [
    '62','63','64','65','66','67','68','69','71','72','73','74','75','76','77',
    '78','79','81','82','83','84','85','86','87','88'
  ] }]
};

const P10 = {
  page: 10, headerRows: 1,
  rows: [
    'deck-less with 4 speakers', 'AM/FM cassette', 'BBS wheels', SPOILER,
    'manual air conditioning', 'Version S specification, standard paint',
    'driver power seat', 'driver and passenger power seats', 'leather seats',
    'high-performance glass pack', KEYLESS,
    'Version R specification, standard paint', 'Recaro seats',
    'deck-less with 2 speakers', 'keyless entry deleted',
    // The disc prints フロス here where the equivalent row on page 8 prints
    // クロス. Checked at 3x against page 8's own glyph, same font and size:
    // page 8 has the hook on the ク and this does not, so the difference is in
    // the document rather than in the rendering. Read as cloth, which is what
    // the same row is called two windows earlier, and recorded here rather
    // than quietly corrected.
    'cloth seats',
    'Super Fine Hard Coat deleted'
  ],
  groups: [{ key: '', codes: [
    '21','22','23','25','31','32','34','58','61','62','66',
    'A1','A2','A3','B1','B2','B3','B4','B5','B6',
    'C1','C2','C3','C4','C5','C6','C7','C8'
  ] }]
};

const P11_ROWS = [
  'xenon headlamps', 'AM/FM cassette stereo', SPOILER, 'leather seats',
  'BBS alloy wheels', 'bright-polished alloy wheels', 'Super Fine Hard Coat'
];

const P11 = {
  page: 11, headerRows: 1, rows: P11_ROWS,
  groups: [{ key: '', codes: [
    '70','71','72','73','74','75','76','77','78','79','80','81','82','83','84',
    '85','86','87','88','89','90','91','92','93','94','95','96'
  ] }]
};

const P12 = {
  page: 12, headerRows: 1, rows: P11_ROWS,
  groups: [{ key: '', codes: [
    '97','98','99','D1','D2','D3','D4',
    'E1','E2','E3','E4','E5','E6','E7','E8',
    'F1','F2','F3','F4',
    'G1','G2','G3','G4','G5','G6','G7','G8'
  ] }]
};

// ---- read ------------------------------------------------------------------

const note = fs.readFileSync(path.join(SRC, 'MAENOTE.132'));
const img = fs.readFileSync(path.join(SRC, 'MAEIMG.132'));

function marksFor(spec) {
  const r = note.subarray((spec.page - 1) * REC, spec.page * REC);
  const off = ((r[48] << 16) | (r[49] << 8) | r[50]) * 256;
  const len = (r[52] << 8) | r[53];
  const res = readMarks(img.subarray(off, off + len),
                        { width: 1280, dataFrom: spec.headerRows, dataCol: 1 });

  const codes = spec.groups.reduce((n, g) => n + g.codes.length, 0);
  const wantRows = spec.headerRows + spec.rows.length;
  const wantCols = 1 + codes;
  const gotRows = res.marks.length, gotCols = (res.marks[0] || []).length;
  if (gotRows !== wantRows || gotCols !== wantCols) {
    throw new Error(
      `page ${spec.page}: grid is ${gotRows}x${gotCols} but the transcription ` +
      `describes ${wantRows}x${wantCols} (${spec.headerRows} header + ` +
      `${spec.rows.length} rows, ${codes} codes). One of them is wrong - fix ` +
      `before trusting anything this writes.`);
  }
  return res;
}

// Equipment for one code, in row order, with delete-options named as such -
// the same shape the [8907-9309] table already uses ("... deleted").
function describe(res, spec, colIndex) {
  const parts = [];
  for (let r = 0; r < spec.rows.length; r++) {
    const cell = res.marks[spec.headerRows + r][1 + colIndex];
    if (!cell || !cell.mark) continue;
    parts.push(cell.mark === 'delete' ? spec.rows[r] + ' deleted' : spec.rows[r]);
  }
  return parts;
}

function readPage(spec) {
  const res = marksFor(spec);
  const out = {};
  let col = 0;
  for (const g of spec.groups) {
    out[g.key] = out[g.key] || {};
    for (const code of g.codes) {
      const parts = describe(res, spec, col++);
      // A code with no marks in any row is still a code. Page 11 prints 70 as
      // a column and leaves every cell blank, and 70 is the single most common
      // pack in the [9810- ] window. Dropping it made a documented code look
      // unrecognised, so it is recorded as what it is: the base car, nothing
      // added. Only the caller can tell that apart from a code the legend has
      // never heard of, and the difference matters.
      out[g.key][code] = parts.length ? parts.join(' + ') : 'No additional equipment';
    }
  }
  return out;
}

const w2 = readPage(P7);
const w3 = Object.assign({}, readPage(P8)[''], readPage(P9)['']);
const w4 = readPage(P10)[''];
const w5 = Object.assign({}, readPage(P11)[''], readPage(P12)['']);

// 首都圏限定車 (LIMITED S), the small second table on page 7. Two codes, and
// its columns DO split MT from AT. Read by eye: both carry the rear spoiler,
// the AT car also deletes the audio.
w2.LIMITED = { '52': SPOILER, '59': SPOILER + ' + audio deleted' };

const doc = { generated: new Date().toISOString().slice(0, 10), w2, w3, w4, w5 };

const count = (o) => Object.values(o).reduce(
  (n, v) => n + (typeof v === 'string' ? 1 : Object.keys(v).length), 0);

console.log('W2 [9309-9410]:', count(w2), 'codes across', Object.keys(w2).join(', '));
console.log('W3 [9410-9701]:', Object.keys(w3).length, 'codes');
console.log('W4 [9701-9810]:', Object.keys(w4).length, 'codes');
console.log('W5 [9810-    ]:', Object.keys(w5).length, 'codes');

if (process.argv.includes('--write')) {
  const out = path.join(__dirname, 'docs', 'wip', 'z32-packs.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  console.log('\nwrote', path.relative(__dirname, out));
} else {
  console.log('\nSamples:');
  for (const [w, t] of [['W2.TT', w2.TT], ['W3', w3], ['W4', w4], ['W5', w5]]) {
    const k = Object.keys(t).slice(0, 3);
    for (const c of k) console.log('  ' + w + ' ' + c + ' = ' + t[c]);
  }
  console.log('\n(dry run - pass --write to save)');
}
