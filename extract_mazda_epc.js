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
//   [2..5]   MODEL VARIANT   "F109" - keys BTCEMDV, decoded below
//   [6..8]   equipment       "210", "31L", "3CF" - NOT decoded
//   [9..11]  EXTERIOR PAINT  "PZ", "18G", "25G"
//   [12..14] INTERIOR TRIM   "FE2", "FF1"
//
// THE VARIANT IS FOUR CHARACTERS, NOT FIVE. That was wrong on the first pass,
// and BTCEMDV is what settles it: its keys are four wide (F138, F139), and a
// five-character reading of the spec matches 3 of 157,386 codes against
// 157,386 of 157,386 for the four-character one. The stray character belongs
// to the equipment field.
//
// BTCEMDV maps each variant to about ten five-character attribute codes, and
// BTCEAI2 gives each of those a Shift-JIS description, so a variant spells
// out into a full specification:
//
//   F176 = coupe, 280PS, rotary, 13B, manual, 5-speed, Bilstein dampers,
//          ABS, 17-inch wheels, Spirit R, two-seat
//
// which is an RX-7 Spirit R Type A. F177 is the four-seat Type B and F175 the
// 255PS automatic Type C - the exact three-car Spirit R lineup, arrived at
// from the discs alone.
//
// The EQUIPMENT field resists. Its three characters behave like independent
// sub-fields ([6] one of 1-5 and 9, [7] one of 1, C, H, K), neither of which
// tracks build year, and nothing found so far keys on them: BTCESES maps part
// groups to figures, BTCEILB is illustration blocks with attribute filters,
// and BTCEAI1 is part applicability. It is emitted raw.
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

// ---------------------------------------------------------------------------
// The variant attribute vocabulary, from BTCEAI2.
//
// BTCEMDV maps a four-character variant key to about ten five-character
// attribute codes; BTCEAI2 gives each of those a Shift-JIS description. So
// F138 = B3103 B4PC5 B4103 B423B B5102 B5204 B6A03 B6E01 B6H16 B6S01 reads as
// coupe, 255HP, rotary, 13B, AT, 4-speed, normal dampers, ABS, 16-inch wheels,
// normal suspension — which is an RX-7 FD Series 6 automatic.
//
// 1,004 codes carry text across the discs. Roughly 194 of those are AAA-prefixed
// illustration annotations rather than vehicle attributes. The 89 below are
// every attribute the sixteen named cars use; the other chassis fall back to
// the raw Japanese, which is emitted rather than guessed at.
const ATTR = {
  // body
  B3101: 'saloon', B3103: 'coupe', B3104: 'hatchback', B3105: 'hardtop',
  B3108: 'cabriolet', B3141: 'open top',
  B3302: '2-door', B3303: '3-door', B3304: '4-door',
  B3S00: 'no sunroof', B3S01: 'sunroof', B3S03: 'sliding sunroof',
  B3S05: 'cabriolet', B3S15: 'no retractable hardtop', B3S16: 'retractable hardtop',
  // engine
  B4101: 'petrol', B4103: 'rotary', B4H03: 'rotary',
  B4216: '1600cc', B4218: '1800cc', B4220: '2000cc',
  B422A: '12A', B422C: '20B', B423B: '13B',
  B4302: 'two-rotor', B4303: 'three-rotor',
  B4E01: 'EGI', B4F00: 'regular petrol', B4F03: 'premium petrol',
  B4H01: 'OHC', B4H02: 'DOHC',
  B4P01: 'standard power', B4P02: 'high power',
  B4PC5: '255PS', B4PD5: '265PS', B4PE0: '280PS',
  B4T00: 'naturally aspirated', B4T01: 'turbo',
  // transmission
  B5101: 'manual', B5102: 'automatic', B5E04: 'manual', B5E02: 'EC-AT',
  B5204: '4-speed', B5205: '5-speed', B5206: '6-speed', B5301: 'floor shift',
  // chassis
  B66S0: 'no side spoiler', B66S3: 'large side spoiler',
  B6A00: 'no self-levelling suspension', B6A01: 'self-levelling suspension',
  B6A02: 'Bilstein dampers', B6A03: 'normal dampers',
  B6A05: 'height-adjustable dampers',
  B6B04: 'four-wheel discs',
  B6D01: 'open differential', B6D02: 'limited-slip differential',
  B6D03: 'viscous LSD', B6D04: 'Torsen LSD',
  B6E00: 'no ABS', B6E01: 'ABS',
  B6H16: '16-inch wheels', B6H17: '17-inch wheels',
  B6S01: 'normal suspension', B6S03: 'hard suspension', B6S06: 'sports suspension',
  B6S30: 'Mazdaspeed suspension', B6S52: 'bespoke tuned suspension',
  // grade and edition
  B6I02: '10th Anniversary', B6I03: 'excluding 10th Anniversary',
  B6I24: 'Spirit R', B6I25: 'excluding Spirit R',
  B6ISE: 'limited edition', B6ISX: 'excluding limited edition',
  B6P02: 'two-seat', B6P04: 'four-seat', B6P40: 'standard',
  B6P42: 'Mazdaspeed-bodied', B6P43: 'NR-A',
  B7101: 'no special bodywork',
  // equipment
  BA800: 'no airbag', BA801: 'airbag',
  BB200: 'no GPS antenna hole', BB201: 'GPS antenna hole',
  BB300: 'no rally version', BB301: 'rally version',
  BB302: 'excluding Custom Built Type A',
  BD300: 'no DSC', BD301: 'DSC'
};

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
  // The Cosmo is four codes, not two.
  //
  // JC3SE and JCESE run 1990-02 to 1994-01/02 and were the whole of the first
  // extraction. JC3S and JCES pick up where those stop - 1994-03-16 and
  // 1994-02-23 - with their serials restarting at 100001, which is a new
  // series rather than a different car. Their paint vocabularies barely
  // overlap the earlier ones (no shared code on the 13B, one on the 20B),
  // which is what a facelift colour range looks like and is why they were not
  // obviously the same model at a glance.
  //
  // What settles it is the total. All four together give 8,874 cars, and
  // Eunos Cosmo production is commonly cited at about 8,875. The two earlier
  // codes alone give 8,125, which is 750 short of every published figure.
  JC3SE: 'Eunos Cosmo 13B',
  JC3S:  'Eunos Cosmo 13B (1994- series)',
  JCESE: 'Eunos Cosmo 20B triple-rotor',
  JCES:  'Eunos Cosmo 20B triple-rotor (1994- series)',
  FC3C:  'Savanna RX-7 Cabriolet (FC)',
  SA22C: 'Savanna RX-7 (SA/FB)'
};

// String interning.
//
// Extracting all 647 chassis means 8.2 million records, and holding one object
// per record with its own date and spec strings runs to several gigabytes.
// Dates and spec codes repeat enormously across a catalogue - a whole day's
// production shares a date, and a model-year shares a handful of specs - so
// each distinct string is stored once and records carry an integer.
const pool = { date: new Map(), spec: new Map(), dateList: [], specList: [] };
function intern(kind, value) {
  const map = pool[kind];
  let id = map.get(value);
  if (id === undefined) {
    id = map.size;
    map.set(value, id);
    pool[kind + 'List'].push(value);
  }
  return id;
}

// `want` is a Set of chassis codes, or null to take everything.
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
      if (want && !want.has(chassis)) continue;
      if (!chassis || !/^[A-Z][A-Z0-9]{1,7}$/.test(chassis)) continue;
      // The catalogue carries one row under the chassis code "DUMMY", dated
      // 1984-07-18. It is a placeholder in Mazda's own data, not a car, and it
      // passes every shape test precisely because it was built to look like a
      // record. Named here rather than filtered by a cleverer rule, so that
      // what is being dropped stays obvious.
      if (chassis === 'DUMMY') continue;
      const serial = s.slice(11, 17).trim();
      const date = s.slice(32, 40);
      // Shape check: a real record has a numeric serial and a plausible date.
      if (!/^\d{1,6}$/.test(serial) || !/^(19|20)\d{6}$/.test(date)) continue;
      const mo = +date.slice(4, 6), dy = +date.slice(6, 8);
      if (mo < 1 || mo > 12 || dy < 1 || dy > 31) continue;
      let arr = hits.get(chassis);
      if (!arr) { arr = []; hits.set(chassis, arr); }
      // [serial, dateId, specId] — three numbers, no per-record strings.
      arr.push(+serial, intern('date', date), intern('spec', s.slice(17, 32)));
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

// BTCEMDV (variant -> attribute codes) and BTCEAI2 (attribute code -> text),
// read from every model directory on every disc.
//
// MDV records are: 4-char variant key, a 0x80 marker, a count byte, then that
// many space-separated 5-character attribute codes.
function variantTables(isoPaths) {
  const dec = new TextDecoder('shift_jis');
  const mdv = new Map(), attr = new Map();
  const walk = (buf, recSize, fn) => {
    const blocks = Math.floor((buf.length - HEADER) / BLOCK);
    const per = Math.floor((BLOCK - 6) / recSize);
    for (let b = 0; b < blocks; b++) {
      const bo = HEADER + b * BLOCK;
      if (bo + 6 > buf.length) break;
      const used = buf.readInt16LE(bo + 4);
      if (used < 0) continue;
      const n = Math.min(Math.floor(used / recSize) + 1, per);
      for (let i = 0; i < n; i++) {
        const ro = bo + 6 + i * recSize;
        if (ro + recSize > buf.length) break;
        fn(buf.subarray(ro, ro + recSize));
      }
    }
  };
  for (const iso of isoPaths) {
    for (const f of listIso(iso).files) {
      if (/\/BTCEMDV\.DB$/i.test(f.path)) {
        const buf = readFile(iso, f); const rs = buf.readUInt16LE(0);
        if (rs < 10 || rs > 400) continue;
        walk(buf, rs, (r) => {
          const key = r.subarray(0, 4).toString('latin1').trim();
          if (!/^[A-Z0-9]{4}$/.test(key) || mdv.has(key)) return;
          const list = r.subarray(6).toString('latin1').split(' ')
            .map(s => s.replace(/\0.*$/, '').trim())
            .filter(s => /^[A-Z0-9]{5}$/.test(s));
          if (list.length) mdv.set(key, list);
        });
      } else if (/\/BTCEAI2\.DB$/i.test(f.path)) {
        const buf = readFile(iso, f); const rs = buf.readUInt16LE(0);
        if (rs < 10 || rs > 200) continue;
        walk(buf, rs, (r) => {
          const t = dec.decode(r).replace(/\0+/g, '');
          const m = /^.([A-Z0-9]{5})(.+)$/.exec(t);
          if (m && !attr.has(m[1])) attr.set(m[1], m[2].trim());
        });
      }
    }
  }
  return { mdv, attr };
}

function main() {
  const write = process.argv.includes('--write');
  const all = process.argv.includes('--all');
  // --all takes every chassis on the discs; the default takes the named set.
  const want = all ? null : new Set(Object.keys(WANTED));
  const hits = new Map();
  if (want) for (const k of want) hits.set(k, []);
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
          if (v.length > (before.get(k) || 0)) {
            if (!sources.has(k)) sources.set(k, new Set());
            sources.get(k).add(isoName + f.path);
          }
        }
      }
    } finally { fs.closeSync(fd); }
  }

  if (write) fs.mkdirSync(OUT_DIR, { recursive: true });

  process.stderr.write('reading BTCEMDV / BTCEAI2 variant tables...\n');
  const variants = variantTables(isos.map(f => path.join(SRC, f)));
  process.stderr.write('reading BTCECLR colour vocabulary...\n');
  const vocab = colourVocabulary(isos.map(f => path.join(SRC, f)));
  console.log('');
  console.log('BTCEMDV: ' + variants.mdv.size.toLocaleString() + ' variant keys   BTCEAI2: ' +
              variants.attr.size.toLocaleString() + ' attribute descriptions');
  console.log('BTCECLR vocabulary: ' + vocab.all.size + ' colour codes across ' +
              vocab.byQual.size + ' qualifiers');

  console.log('');
  console.log('chassis  car                                    raw    unique   dupes   built');
  let totalRaw = 0, totalUniq = 0;
  const written = [];
  const vocabCheck = [];
  const counts = new Map();

  // Named cars first so the report reads sensibly, then everything else by
  // size. In the default run these are the same list.
  const named = Object.keys(WANTED).filter(c => hits.has(c));
  const rest = [...hits.keys()].filter(c => !WANTED[c])
    .sort((a, b) => (hits.get(b).length - hits.get(a).length) || a.localeCompare(b));
  const order = [...named, ...rest];

  for (const code of order) {
    const flat = hits.get(code) || [];
    const rowCount = flat.length / 3;
    totalRaw += rowCount;
    // The same car can appear on more than one disc - FD3S is on RA1 and RB1.
    // Identity is chassis + serial + build date; a repeat of all three is the
    // same car catalogued twice, not two cars.
    const seen = new Map();
    for (let i = 0; i < flat.length; i += 3) {
      const serial = flat[i], date = pool.dateList[flat[i + 1]];
      const key = serial + '|' + date;
      if (!seen.has(key)) seen.set(key, { serial, date, spec: pool.specList[flat[i + 2]] });
    }
    const uniq = [...seen.values()].sort((a, b) => a.serial - b.serial || a.date.localeCompare(b.date));
    totalUniq += uniq.length;
    // Free the raw rows as each chassis is finished — with 647 of them the
    // accumulated arrays are the largest thing in the process.
    hits.set(code, []);

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
    // The variant key is FOUR characters, not five. BTCEMDV is keyed on four
    // (F138, F139) and a five-character reading matches 3 of 157,386 spec
    // codes against 157,386 of 157,386 for the four-character one. The stray
    // character belongs to the equipment field, which is three wide.
    const [markets, mkIdx] = dict(0, 2);
    const [fcodes, fcIdx]  = dict(2, 6);
    const [equips, eqIdx]  = dict(6, 9);
    const [paints, ptIdx]  = dict(9, 12);
    const [trims, trIdx]   = dict(12, 15);

    // What each variant actually is, from BTCEMDV -> BTCEAI2. Untranslated
    // codes fall back to the disc's own Japanese rather than being dropped or
    // guessed at.
    const fspec = {};
    for (const v of fcodes) {
      const codes = variants.mdv.get(v);
      if (!codes) continue;
      const words = codes.map(c => ATTR[c] || variants.attr.get(c) || c);
      fspec[v] = words.join(' · ');
    }

    const iso = (d) => d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
    // Only the named cars are listed individually; with --all the other 600-odd
    // would bury them, so those are summarised at the end instead.
    if (WANTED[code] || !all)
      console.log('  ' + code.padEnd(7) + (WANTED[code] || '').padEnd(36) +
                  String(rowCount).padStart(7) + String(uniq.length).padStart(9) +
                  String(rowCount - uniq.length).padStart(8) + '   ' +
                  (uniq.length ? iso(dates[0]) + '..' + iso(dates[dates.length - 1]) : '-'));

    counts.set(code, uniq.length);
    if (uniq.length)
      vocabCheck.push([code, { paint: new Set(paints), trim: new Set(trims) }]);

    // A dictionary index that comes back undefined means the row slice and the
    // dictionary slice have drifted apart. Nothing else notices: the file still
    // writes, the dictionaries still look right, and every decoded field reads
    // "undefined" downstream.
    if (uniq.length) {
      const probe = uniq[0];
      const bad = [['market', mkIdx.get(field(probe.spec, 0, 2))],
                   ['fcode', fcIdx.get(field(probe.spec, 2, 6))],
                   ['equip', eqIdx.get(field(probe.spec, 6, 9))],
                   ['paint', ptIdx.get(field(probe.spec, 9, 12))],
                   ['trim', trIdx.get(field(probe.spec, 12, 15))]]
                  .filter(([, v]) => v === undefined).map(([k]) => k);
      if (bad.length)
        throw new Error(code + ': spec field(s) ' + bad.join(', ') +
                        ' did not resolve — row slices and dictionary slices disagree');
    }

    if (!write || !uniq.length) continue;
    const out = {
      m: code,
      // Only the sixteen curated codes have a confirmed model name. The rest
      // are emitted with their chassis code alone rather than a guess.
      name: WANTED[code] || null,
      n: uniq.length,
      d: dates.map(iso),
      // Spec code split into its five fields. `paint` and `trim` are confirmed
      // against BTCECLR; `fcode` and `equip` are positional readings only.
      market: markets, fcode: fcodes, equip: equips, paint: paints, trim: trims,
      // Each variant key spelled out from BTCEMDV + BTCEAI2.
      fspec,
      // The raw 15-character code, kept so nothing depends on the split above
      // being right forever.
      sc: specs,
      // [serial, date, market, fcode, equip, paint, trim, rawSpec]
      // Slices must match the dictionaries above exactly — variant 4 wide at
      // [2..5], equipment 3 wide at [6..8]. They did not, briefly, and the
      // effect was silent: fcIdx.get() simply returned undefined for every
      // row while the dictionaries themselves looked perfectly correct.
      r: uniq.map(r => [r.serial, dIdx.get(r.date),
                        mkIdx.get(field(r.spec, 0, 2)), fcIdx.get(field(r.spec, 2, 6)),
                        eqIdx.get(field(r.spec, 6, 9)), ptIdx.get(field(r.spec, 9, 12)),
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

  // Families that span more than one chassis code, totalled — the Cosmo's
  // four codes are the reason this exists, and 8,874 against a published
  // ~8,875 is the check that says none of them is missing.
  const FAMILIES = {
    'Eunos Cosmo':  ['JC3SE', 'JC3S', 'JCESE', 'JCES'],
    'RX-7':         ['SA22C', 'FC3S', 'FC3C', 'FD3S'],
    'Roadster/MX-5': ['NA6CE', 'NA8C', 'NB6C', 'NB8C', 'NCEC']
  };
  console.log('');
  console.log('by family:');
  for (const [fam, codes] of Object.entries(FAMILIES)) {
    const n = codes.reduce((s, c) => s + (counts.get(c) || 0), 0);
    console.log('  ' + fam.padEnd(16) + String(n).padStart(8) + '   ' + codes.join(' + '));
  }

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
