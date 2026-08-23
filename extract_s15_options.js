// extract_s15_options.js - the S15 Silvia option code tables, volume 089.
//
// The S15 was missing from this archive entirely: 36,923 records sitting in
// VINDAT3.AB3 that the site had never held. Volume 089 documents them
// properly, which is more than the S14 next door can say.
//
//   page 2   モデル記号の意味 (その1) [199901- ]   the layout
//   page 3   その2   14桁目   option code, position 14
//   page 4   その3   15桁目   position 15
//   page 5   その4   16桁目 AND 17桁目, two tables stacked
//   page 6   その5   18桁目   position 18
//   pages 1, 7-10   Autech variants: Version 6MT, Varietta, Style-A,
//                   Driving Helper
//
// LAYOUT, from page 2, and it is positional rather than chassis-led:
//
//   [1 車体形状 G クーペ][2-3 エンジン BY SR20DE][4 アクスル A 2WS / B 4WS]
//   [5 R 右ハンドル][6 グレード T S / U S-AERO,R][7 変速機 F MT5 / Y MT6 / A AT4]
//   S15 [11 燃料装置 E EGI / U ターボ][12 仕向地 D 標準地 / Z 寒冷地]
//   [13 特装 4 標準][14-18 オプションコード]
//
// The export drops the leading 車体形状 as everywhere else, so a stored code
// "BYARUYS15UD4C--A-" is G BY A R U Y S15 U D 4 then the option group C--A-.
//
// EACH OPTION POSITION IS ITS OWN ALPHABET. Position 14 has 24 letters plus
// "-", position 15 has five, and the letters skip I and O throughout. A dash
// means standard - no option at that position - which is why so many codes
// read like "C--A-".
//
// COLUMNS ARE INDEXED FROM THE RIGHT. These tables carry two label columns
// (SPEC CODE and 呼称) and the diagonal header sometimes yields a third rule,
// so counting from the left is fragile; the option columns are always the
// last N, and N is known from the transcription.
//
// The SPEC CODE column is Nissan's own token for each item - WIPR2, ABAGS,
// LMPHW - and the same tokens appear in SPECDSC.AA1, the option glossary on
// the disc. They are carried through to the output as provenance.
//
// USAGE
//   node extract_s15_options.js            print
//   node extract_s15_options.js --write    write docs/wip/s15-options.json

'use strict';
const fs = require('fs');
const path = require('path');
const { readMarks } = require('./fast_matrix.js');

const SRC = 'H:/AR-JP/JP/089';
const REC = 54;

const L = (spec, text) => ({ spec, text });

const TABLES = [
  {
    pos: '14', page: 3, minRowFrac: 0.45, minColFrac: 0.60,
    codes: ['-','A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z'],
    rows: [
      L('-',     'standard'),
      L('WIPR2', 'rear wiper'),
      L('SPOI5', 'rear spoiler'),
      L('MUDG3', 'side sill protector'),
      L('WHSTE', 'leather trim, red stitching'),
      L('OMET2', 'pillar gauge, oil pressure'),
      L('BMET2', 'pillar gauge, boost'),
      L('LMPF5', 'front fog lamps'),
      L('SMET5', 'titanium meter finisher'),
      L('LMRF2', 'rear fog lamp'),
      L('WHSTC', 'leather trim, blue stitching'),
      L('STTMQ', 'interior, orange or blue'),
      L('STTMW', 'silver interior'),
      L('WHST3', 'leather steering wheel, silver stitching'),
      L('STTMR', 'punched suede-style seats and door trim')
    ]
  },
  {
    pos: '15', page: 4, minRowFrac: 0.35, minColFrac: 0.60,
    codes: ['-','A','B','C','D','E'],
    rows: [
      L('-',     'standard'),
      L('TYR5H', '16-inch alloy wheels'),
      L('DIFF7', 'rear helical LSD'),
      L('DIFF6', 'rear viscous LSD'),
      L('DWHLG', '16-inch alloy wheels, chrome'),
      L('DWHLZ', 'steel wheels')
    ]
  },
  {
    pos: '16', page: 5, minRowFrac: 0.20, minColFrac: 0.30, rowBand: [170, 320],
    codes: ['-','A','B','C','D','E','F','G','H','J','K','L'],
    rows: [
      L('-',     'standard'),
      L('ROOF2', 'sunroof'),
      L('GLSSW', 'privacy glass'),
      L('KYLS4', 'remote door lock'),
      L('GLSDP', 'water-repellent door glass deleted')
    ]
  },
  {
    pos: '17', page: 5, minRowFrac: 0.20, minColFrac: 0.30, rowBand: [370, 610],
    codes: ['-','A','B','C','D','E','F','G'],
    rows: [
      L('-',     'standard'),
      L('STERX', 'audio deleted'),
      L('STERW', 'holographic sound system'),
      L('SPKRB', '7 speakers'),
      L('TELV2', 'TV / navigation system, CD'),
      L('TELV3', 'TV / navigation system, DVD'),
      L('SPKRZ', 'speakers deleted'),
      L('NAVI3', 'J-navi navigation system, CD'),
      L('STERV', '1DIN radio with CD and MD')
    ]
  },
  {
    pos: '18', page: 6, minRowFrac: 0.45, minColFrac: 0.60,
    codes: ['-','A','B','C','D','E','F','G','K','L','M','N','P','Q'],
    rows: [
      L('-',     'standard'),
      L('STTMQ', 'interior, orange or blue'),
      L('LMPHW', 'xenon headlamps'),
      L('ABAGS', 'side airbags'),
      L('LMPRC', 'headlamp inner silver'),
      L('ETCTC', 'aluminium pedals'),
      L('STRRJ', 'one-way trunk through'),
      L('MIROW', 'door mirror titanium clear finish deleted')
    ]
  }
];

const note = fs.readFileSync(path.join(SRC, 'MAENOTE.089'));
const img = fs.readFileSync(path.join(SRC, 'MAEIMG.089'));

function read(t) {
  const r = note.subarray((t.page - 1) * REC, t.page * REC);
  const off = ((r[48] << 16) | (r[49] << 8) | r[50]) * 256;
  const len = (r[52] << 8) | r[53];
  const res = readMarks(img.subarray(off, off + len), {
    width: 1280, dataFrom: 1, dataCol: 2,
    minRowFrac: t.minRowFrac, minColFrac: t.minColFrac, rowBand: t.rowBand
  });

  const gotRows = res.marks.length, gotCols = (res.marks[0] || []).length;
  if (gotRows !== 1 + t.rows.length) {
    throw new Error(`position ${t.pos} (page ${t.page}): ${gotRows} grid rows, ` +
                    `transcription has ${t.rows.length} rows + header.`);
  }
  if (gotCols < t.codes.length) {
    throw new Error(`position ${t.pos} (page ${t.page}): only ${gotCols} columns ` +
                    `for ${t.codes.length} codes.`);
  }

  const first = gotCols - t.codes.length;   // codes are the rightmost columns
  const out = {};
  t.codes.forEach((code, c) => {
    const parts = [];
    for (let i = 0; i < t.rows.length; i++) {
      if (res.marks[1 + i][first + c].mark) parts.push(t.rows[i]);
    }
    if (!parts.length) return;              // a column with nothing ticked
    out[code] = {
      text: parts.map(p => p.text).join(' + '),
      spec: parts.map(p => p.spec).filter(s => s !== '-')
    };
  });
  return out;
}

const positions = {};
for (const t of TABLES) positions[t.pos] = read(t);

const doc = { generated: new Date().toISOString().slice(0, 10), positions };

for (const p of ['14', '15', '16', '17', '18']) {
  console.log('position', p, Object.keys(positions[p]).length, 'codes');
}

if (process.argv.includes('--write')) {
  const out = path.join(__dirname, 'docs', 'wip', 's15-options.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  console.log('\nwrote', path.relative(__dirname, out));
} else {
  console.log('\nSamples:');
  for (const p of ['14', '15', '16', '17', '18']) {
    for (const c of Object.keys(positions[p]).slice(0, 3)) {
      console.log(`  pos ${p} "${c}" = ${positions[p][c].text}`);
    }
  }
  console.log('\n(dry run - pass --write to save)');
}
