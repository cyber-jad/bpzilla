// extract_rs13_packs.js - the 180SX パック記号 tables, volume 084.
//
// The site had only the first window, [8903-9101], which is the CA18 RS13 car.
// RPS13 - the SR20 180SX, 86,565 records and three quarters of all 180SX
// production - ran through four more windows whose tables had never been read.
//
//   page  7   その7  [9101-9201]   codes 10-27
//   page  8   その8  [9101-9201]   codes 28-35, 46
//   page  9   その9  [9101-9201]   codes 80-93
//   page 11   その11 [9201-9608]   codes 10-35
//   page 12   その12 [9201-9608]   codes 39-55, B1-B7
//   page 14   その14 [9608-9710]   codes 50-77
//   page 15   その15 [9710-    ]   codes 50-6D
//   page 16   その16 [9710-    ]   codes 80-9H
//
// WINDOWS MATTER HERE MORE THAN USUAL. The codes collide: 10, 11, 12, 16, 17
// and others appear in both [9101-9201] and [9201-9608] with different
// equipment, and 50 appears in three separate windows. A flat table would be
// wrong for most of the car's life, so these are keyed by window and the
// caller has to know the date.
//
// The 180SX windows are NOT the Silvia's. _s13Window splits at 9101, 9201 and
// 9205 for the Silvia; the 180SX splits at 9101, 9201, 9608 and 9710. Same
// legend file, different car, different dates - see _rs13Window in database.js.
//
// Pages 10 and 13 are the VS記号 and パーソナルオーダーコード tables, read by
// eye and wired directly into _s13Legend.vs. Page 17 is a grade specification
// table, not packs. Pages 1-3 are the layout diagrams.
//
// METHOD is the same as extract_z32_packs.js: row labels and column codes by
// eye because they are large text, MARKS by fast_matrix.js because a circle is
// 12px on a 1280px page, and the script refuses to write unless the
// machine-read grid matches the transcription exactly.
//
// USAGE
//   node extract_rs13_packs.js            print
//   node extract_rs13_packs.js --write    write docs/wip/rs13-packs.json

'use strict';
const fs = require('fs');
const path = require('path');
const { readMarks } = require('./fast_matrix.js');

const SRC = 'H:/AR-JP/JP/084';
const REC = 54;

// The seven-row vocabulary used by the [9101-9201] and [9201-9608] tables.
const ROWS_A = [
  '6JJx15 alloy road wheels', 'front window display', 'ABS',
  'front and rear spoilers', 'electronically controlled active sound system',
  'no audio', 'rear fog lamp'
];

// [9608-9710] drops to four rows.
const ROWS_B = [
  '15-inch alloy road wheels', 'viscous LSD', 'no audio', 'Super Fine Hard Coat'
];

// [9710- ] adds three more.
const ROWS_C = ROWS_B.concat([
  'CD selection', 'rear green glass with ornament', 'privacy glass'
]);

const PAGES = [
  { page: 7,  win: 'W2', rows: ROWS_A, codes: ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27'] },
  { page: 8,  win: 'W2', rows: ROWS_A, codes: ['28','29','30','31','32','33','34','35','46'] },
  { page: 9,  win: 'W2', rows: ROWS_A, codes: ['80','81','82','83','84','85','86','87','88','89','90','91','92','93'] },
  { page: 11, win: 'W3', rows: ROWS_A, codes: ['10','11','12','16','17','21','22','23','27','28','32','33','34','35'] },
  { page: 12, win: 'W3', rows: ROWS_A, codes: ['39','44','46','50','55','B1','B2','B3','B4','B5','B6','B7'] },
  { page: 14, win: 'W4', rows: ROWS_B, codes: ['50','51','52','53','60','61','62','63','70','71','72','73','74','75','76','77'] },
  { page: 15, win: 'W5', rows: ROWS_C, codes: ['50','51','52','53','5A','5B','5C','5D','60','61','6A','6B','62','63','6C','6D'] },
  // Page 16 alone needs a two-row header: the ※4/※5 grade brackets above the
  // code row are drawn heavily enough that the rule detector counts them as a
  // table line. Every other page here is a single header row.
  { page: 16, win: 'W5', headerRows: 2, rows: ROWS_C, codes: ['80','81','82','83','84','85','86','87','8A','8B','8C','8D','8E','8F','8G','8H','9A','9B','9C','9D','9E','9F','9G','9H'] }
];

const note = fs.readFileSync(path.join(SRC, 'MAENOTE.084'));
const img = fs.readFileSync(path.join(SRC, 'MAEIMG.084'));

function read(spec) {
  const r = note.subarray((spec.page - 1) * REC, spec.page * REC);
  // MAENOTE.NNN record layout (see fast_image.js): [48-50] image offset in
  // 256-byte blocks, [52-53] image byte length.
  const off = ((r[48] << 16) | (r[49] << 8) | r[50]) * 256;
  const len = (r[52] << 8) | r[53];
  const hdr = spec.headerRows || 1;
  const res = readMarks(img.subarray(off, off + len), { width: 1280, dataFrom: hdr, dataCol: 1 });

  const wantRows = hdr + spec.rows.length, wantCols = 1 + spec.codes.length;
  const gotRows = res.marks.length, gotCols = (res.marks[0] || []).length;
  if (gotRows !== wantRows || gotCols !== wantCols) {
    throw new Error(
      `page ${spec.page}: grid ${gotRows}x${gotCols}, transcription says ` +
      `${wantRows}x${wantCols} (${spec.rows.length} rows, ${spec.codes.length} ` +
      `codes). One of them is wrong.`);
  }

  const out = {};
  spec.codes.forEach((code, c) => {
    const parts = [];
    for (let r2 = 0; r2 < spec.rows.length; r2++) {
      const cell = res.marks[hdr + r2][1 + c];
      if (cell && cell.mark) parts.push(spec.rows[r2]);
    }
    // As on the Z32 pages, a code with no marks is still a code - it means the
    // base car. Saying so is different from not recognising it.
    out[code] = parts.length ? parts.join(' + ') : 'No additional equipment';
  });
  return out;
}

const win = {};
for (const spec of PAGES) {
  const t = read(spec);
  win[spec.win] = Object.assign(win[spec.win] || {}, t);
}

const doc = { generated: new Date().toISOString().slice(0, 10), packs: win };

for (const w of ['W2', 'W3', 'W4', 'W5']) {
  console.log(w, Object.keys(win[w] || {}).length, 'codes');
}

if (process.argv.includes('--write')) {
  const out = path.join(__dirname, 'docs', 'wip', 'rs13-packs.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  console.log('\nwrote', path.relative(__dirname, out));
} else {
  console.log('\nSamples:');
  for (const w of ['W2', 'W3', 'W4', 'W5']) {
    const k = Object.keys(win[w] || {}).slice(0, 2);
    for (const c of k) console.log('  ' + w + ' ' + c + ' = ' + win[w][c]);
  }
  console.log('\n(dry run - pass --write to save)');
}
