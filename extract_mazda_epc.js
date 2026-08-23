// extract_mazda_epc.js - per-car build records from the Mazda EPC discs.
//
// WHAT THIS IS
//
// A second archive, from a different marque and a different vendor's software,
// that happens to hold the same kind of thing the Nissan FAST discs do: one
// record per car built, keyed by chassis code and serial. Source is the 2008
// Mazda Electronic Parts Catalog, five ISO images.
//
// The catalogue is VIN-indexed - its own window title reads
// "Pictorial index Image/Text VIN:LW3W-301101" - and the index behind that is
// a set of Borland Paradox tables, one BTCENVI.DB per model directory. 661
// chassis codes and 8,588,055 records in total; this extracts the fourteen
// rotary and roadster codes, 383,742 records.
//
// READING THE DISCS
//
// The ISOs are read directly rather than mounted: ISO 9660 puts its Primary
// Volume Descriptor at sector 16 and the root directory record at offset 156
// within it, which is enough to walk the tree and pull a file by its extent.
// See iso.js.
//
// RECORD FORMAT (BTCENVI.DB, Paradox)
//
//   2048-byte table header, then 4096-byte blocks. Each block starts with a
//   6-byte header - next block, previous block, and bytes-used - followed by
//   40-byte records:
//
//     [0..10]  chassis code, space padded   "   FD3S    "
//     [11..16] serial                       "500013"
//     [17..31] spec code                    "JPF141310NU FF1"
//     [32..39] build date                   "19981216"
//
//   The chassis field comes FIRST. Reading it last - which the field order in
//   a dumped record makes tempting, because the padding falls either side of
//   the code - yields nothing at all, since the date then lands on the spec
//   string. Blocks carry `used` as (bytes used - recordSize), so the count is
//   used/40 + 1.
//
// THE SPEC CODE
//
// Chassis, serial and build date are read directly and are exact. The build
// date is a full YYYYMMDD, finer than the YYMM the Nissan records carry.
//
// The 15-character spec code splits into five fields:
//
//   [0..1]   market          "JP" on every JDM car
//   [2..6]   model/spec      "F1092" - a grade-and-era variant; each value
//                            spans only one to three model years
//   [7..8]   equipment       "10", "C0", "1A", "CW" - not decoded
//   [9..11]  EXTERIOR PAINT  "PZ", "18G", "25G"
//   [12..14] INTERIOR TRIM   "FE2", "FF1"
//
// The two colour fields are confirmed against BTCECLR, the colour-dependent
// parts table each model directory carries. Its 55-byte records hold a colour
// code at [45..47] and a qualifier at [48..50], and restricting them to the
// FD's own model code separates the two vocabularies cleanly: qualifier 298
// yields {18G, 20P, A3F, NU, PT} - which is what cars carry at [9..11] - and
// qualifier 100 yields {FF1}, which is what they carry at [12..14]. Across
// the whole FD3S run, 21 of 23 values at [9..11] and 9 of 9 at [12..14] are
// codes BTCECLR itself lists.
//
// Two independent sanity checks on the paint field: PZ is the single most
// common FD3S colour at 12,528 cars (24%), and Brilliant Black is
// well-documented as the FD's most popular colour; 18G and 25G are real FD
// colours (Montego Blue Mica, Competition Yellow).
//
// PADDING IS NUL, NOT SPACE. A two-character paint code is stored "NU\0", and
// a plain .trim() leaves the NUL attached, so the code matches nothing. That
// single detail made 16 of the FD3S's 23 paint codes look absent from a table
// that in fact lists them.
//
// NO NAMES. BTCECLR carries codes and no text. The sibling tables were checked
// and none is a colour dictionary: BTCESNM holds part-group names in katakana,
// BTCENTX part text, BTCEKAR numeric codes, and the shared root tables
// (BTCECHR, BTCEAI1, BTCEPPC) are part cross-reference and pricing. A parts
// catalogue only needs the code to pick the right painted panel, so the names
// may simply not be on these discs. Codes are emitted as-is rather than
// guessed at.
//
// The raw 15-character code is kept verbatim in `sc` alongside the split
// fields, so nothing is lost if this reading is ever revised.
//
// NOT SERVED. Output goes to public/data/mazda/ and nothing loads it. The site
// is a Nissan archive; whether it ever becomes something wider is a decision
// about what the site IS, not about whether the data parses.
//
// USAGE
//   node extract_mazda_epc.js                 survey, write nothing
//   node extract_mazda_epc.js --write         write public/data/mazda/*.json

'use strict';
const fs = require('fs');
const path = require('path');
const { listIso, readFile, SECTOR } = require('./iso.js');

const SRC = 'C:/Users/cyber/Downloads/JDM_EPC (1)';
const OUT_DIR = path.join(__dirname, 'public', 'data', 'mazda');

const HEADER = 2048, BLOCK = 4096, REC = 40;

// The fourteen. Names are the JDM market names; where a car is better known
// by its export name that is given too.
const WANTED = {
  NA6CE: 'Eunos Roadster 1.6 (MX-5 NA)',
  FC3S:  'Savanna RX-7 (FC)',
  FD3S:  'Efini RX-7 (FD)',
  SE3P:  'RX-8',
  NA8C:  'Eunos Roadster 1.8 (MX-5 NA)',
  BFMR:  'Familia GT-X / GT-Ae turbo 4WD',
  NB8C:  'Roadster 1.8 (MX-5 NB)',
  NB6C:  'Roadster 1.6 (MX-5 NB)',
  NCEC:  'Roadster (MX-5 NC)',
  BG8Z:  'Familia GT-R',
  JC3SE: 'Eunos Cosmo 13B',
  JCESE: 'Eunos Cosmo 20B triple-rotor',
  FC3C:  'Savanna RX-7 Cabriolet (FC)',
  SA22C: 'Savanna RX-7 (SA/FB)'
};

function readRecords(buf, want, hits) {
  const blocks = Math.floor((buf.length - HEADER) / BLOCK);
  const perBlock = Math.floor((BLOCK - 6) / REC);
  for (let b = 0; b < blocks; b++) {
    const bo = HEADER + b * BLOCK;
    if (bo + 6 > buf.length) break;
    const used = buf.readInt16LE(bo + 4);
    if (used < 0) continue;
    const n = Math.min(Math.floor(used / REC) + 1, perBlock);
    for (let i = 0; i < n; i++) {
      const ro = bo + 6 + i * REC;
      if (ro + REC > buf.length) break;
      const s = buf.subarray(ro, ro + REC).toString('latin1');
      const chassis = s.slice(0, 11).trim();
      if (!want.has(chassis)) continue;
      const serial = s.slice(11, 17).trim();
      const spec = s.slice(17, 32);
      const date = s.slice(32, 40);
      // Shape check: a real record has a numeric serial and a plausible date.
      if (!/^\d{1,6}$/.test(serial) || !/^(19|20)\d{6}$/.test(date)) continue;
      const mo = +date.slice(4, 6), dy = +date.slice(6, 8);
      if (mo < 1 || mo > 12 || dy < 1 || dy > 31) continue;
      (hits.get(chassis) || hits.set(chassis, []).get(chassis))
        .push({ serial: +serial, spec, date });
    }
  }
}

// Every colour code BTCECLR lists, so the paint and trim fields can be checked
// against the discs' own vocabulary rather than taken on trust.
//
// BTCECLR is 55-byte records: [40..43] model, [45..47] colour, [48..50] a
// qualifier that separates exterior paint (298/200) from interior trim (100).
function colourVocabulary(isoPaths) {
  const all = new Set();
  const byQual = new Map();
  for (const iso of isoPaths) {
    for (const f of listIso(iso).files.filter(x => /\/BTCECLR\.DB$/i.test(x.path))) {
      const buf = readFile(iso, f);
      if (buf.length < HEADER + 8 || buf.readUInt16LE(0) !== 55) continue;
      const blocks = Math.floor((buf.length - HEADER) / BLOCK);
      const per = Math.floor((BLOCK - 6) / 55);
      for (let b = 0; b < blocks; b++) {
        const bo = HEADER + b * BLOCK;
        if (bo + 6 > buf.length) break;
        const used = buf.readInt16LE(bo + 4);
        if (used < 0) continue;
        const n = Math.min(Math.floor(used / 55) + 1, per);
        for (let i = 0; i < n; i++) {
          const ro = bo + 6 + i * 55;
          if (ro + 55 > buf.length) break;
          const r = buf.subarray(ro, ro + 55);
          const clean = (x) => x.toString('latin1').replace(/\0/g, ' ').trim();
          const colour = clean(r.subarray(45, 48));
          if (!/^[A-Z0-9]{2,3}$/.test(colour)) continue;
          const qual = clean(r.subarray(48, 51));
          all.add(colour);
          if (!byQual.has(qual)) byQual.set(qual, new Set());
          byQual.get(qual).add(colour);
        }
      }
    }
  }
  return { all, byQual };
}

function main() {
  const write = process.argv.includes('--write');
  const want = new Set(Object.keys(WANTED));
  const hits = new Map();
  for (const k of want) hits.set(k, []);
  const sources = new Map();   // chassis -> Set("iso path")

  const isos = fs.readdirSync(SRC).filter(f => /\.iso$/i.test(f)).sort();
  if (!isos.length) { console.error('no ISO images in ' + SRC); process.exit(1); }

  for (const isoName of isos) {
    const iso = path.join(SRC, isoName);
    const listing = listIso(iso);
    const tables = listing.files.filter(f => /\/BTCENVI\.DB$/i.test(f.path));
    process.stderr.write(isoName + ': ' + tables.length + ' model tables\n');
    const fd = fs.openSync(iso, 'r');
    try {
      for (const f of tables) {
        const buf = Buffer.alloc(f.size);
        fs.readSync(fd, buf, 0, f.size, f.lba * SECTOR);
        const before = new Map([...hits].map(([k, v]) => [k, v.length]));
        readRecords(buf, want, hits);
        for (const [k, v] of hits) {
          if (v.length > before.get(k)) {
            if (!sources.has(k)) sources.set(k, new Set());
            sources.get(k).add(isoName + f.path);
          }
        }
      }
    } finally { fs.closeSync(fd); }
  }

  if (write) fs.mkdirSync(OUT_DIR, { recursive: true });

  process.stderr.write('reading BTCECLR colour vocabulary...\n');
  const vocab = colourVocabulary(isos.map(f => path.join(SRC, f)));
  console.log('');
  console.log('BTCECLR vocabulary: ' + vocab.all.size + ' colour codes across ' +
              vocab.byQual.size + ' qualifiers');

  console.log('');
  console.log('chassis  car                                    raw    unique   dupes   built');
  let totalRaw = 0, totalUniq = 0;
  const written = [];
  const vocabCheck = [];

  for (const code of Object.keys(WANTED)) {
    const rows = hits.get(code) || [];
    totalRaw += rows.length;
    // The same car can appear on more than one disc - FD3S is on RA1 and RB1.
    // Identity is chassis + serial + build date; a repeat of all three is the
    // same car catalogued twice, not two cars.
    const seen = new Map();
    for (const r of rows) {
      const key = r.serial + '|' + r.date;
      if (!seen.has(key)) seen.set(key, r);
    }
    const uniq = [...seen.values()].sort((a, b) => a.serial - b.serial || a.date.localeCompare(b.date));
    totalUniq += uniq.length;

    const dates = [...new Set(uniq.map(r => r.date))].sort();
    const specs = [...new Set(uniq.map(r => r.spec))].sort();
    const dIdx = new Map(dates.map((d, i) => [d, i]));
    const sIdx = new Map(specs.map((s, i) => [s, i]));

    // Split the spec code. Padding is NUL, not space.
    const field = (s, a, b) => s.slice(a, b).replace(/\0/g, ' ').trim();
    const dict = (a, b) => {
      const vals = [...new Set(uniq.map(r => field(r.spec, a, b)))].sort();
      return [vals, new Map(vals.map((v, i) => [v, i]))];
    };
    const [markets, mkIdx] = dict(0, 2);
    const [fcodes, fcIdx]  = dict(2, 7);
    const [equips, eqIdx]  = dict(7, 9);
    const [paints, ptIdx]  = dict(9, 12);
    const [trims, trIdx]   = dict(12, 15);

    const iso = (d) => d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
    console.log('  ' + code.padEnd(7) + WANTED[code].padEnd(36) +
                String(rows.length).padStart(7) + String(uniq.length).padStart(9) +
                String(rows.length - uniq.length).padStart(8) + '   ' +
                (uniq.length ? iso(dates[0]) + '..' + iso(dates[dates.length - 1]) : '-'));

    if (uniq.length)
      vocabCheck.push([code, { paint: new Set(paints), trim: new Set(trims) }]);

    if (!write || !uniq.length) continue;
    const out = {
      m: code,
      name: WANTED[code],
      n: uniq.length,
      d: dates.map(iso),
      // Spec code split into its five fields. `paint` and `trim` are confirmed
      // against BTCECLR; `fcode` and `equip` are positional readings only.
      market: markets, fcode: fcodes, equip: equips, paint: paints, trim: trims,
      // The raw 15-character code, kept so nothing depends on the split above
      // being right forever.
      sc: specs,
      // [serial, date, market, fcode, equip, paint, trim, rawSpec]
      r: uniq.map(r => [r.serial, dIdx.get(r.date),
                        mkIdx.get(field(r.spec, 0, 2)), fcIdx.get(field(r.spec, 2, 7)),
                        eqIdx.get(field(r.spec, 7, 9)), ptIdx.get(field(r.spec, 9, 12)),
                        trIdx.get(field(r.spec, 12, 15)), sIdx.get(r.spec)]),
      _src: [...(sources.get(code) || [])],
      _fields: 'r = [serial, dateIdx, marketIdx, fcodeIdx, equipIdx, paintIdx, trimIdx, specIdx]',
      _note: 'paint/trim confirmed against BTCECLR; no name table exists on these discs. ' +
             'fcode and equip are positional readings, not decoded.'
    };
    const file = path.join(OUT_DIR, 'mz_' + code.toLowerCase() + '.json');
    fs.writeFileSync(file, JSON.stringify(out) + '\n', 'utf8');
    written.push([file, uniq.length]);
  }

  console.log('');
  console.log('raw ' + totalRaw.toLocaleString() + '   unique ' + totalUniq.toLocaleString() +
              '   duplicates removed ' + (totalRaw - totalUniq).toLocaleString());

  // Are the paint and trim readings actually codes the discs know about?
  console.log('');
  console.log('paint/trim checked against BTCECLR:');
  console.log('  chassis  paint codes           trim codes');
  for (const [code, sets] of vocabCheck) {
    const fmt = (s) => {
      const known = [...s].filter(c => vocab.all.has(c)).length;
      return (known + '/' + s.size).padEnd(8) +
        (known === s.size ? 'all known' :
         'unlisted: ' + [...s].filter(c => !vocab.all.has(c)).sort().join(' '));
    };
    console.log('  ' + code.padEnd(8) + fmt(sets.paint).padEnd(34) + '  ' + fmt(sets.trim));
  }

  // Refuse to claim success on an empty read. The field order in these records
  // is easy to get wrong and getting it wrong returns zero rows, not an error.
  if (totalUniq === 0) {
    console.error('\nNOT WRITING: no records matched. Check the record layout ' +
                  'in readRecords - the chassis field is FIRST.');
    process.exit(1);
  }

  if (!write) { console.log('\n(survey only - pass --write to save)'); return; }
  console.log('');
  for (const [f, n] of written)
    console.log('  wrote ' + path.relative(__dirname, f) + '  (' + n.toLocaleString() + ' records, ' +
                (fs.statSync(f).size / 1024 / 1024).toFixed(2) + ' MB)');
}

main();
