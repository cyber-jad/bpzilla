/**
 * BPZILLA — factory paint-name extractor
 *
 * Nissan's FAST discs carry their own colour master. Inside every ABBREV.<nnn>
 * (JP) and ABBR.TXT (export) file sits a categorised abbreviation table; the
 * records whose category character is "C" (and, on a few discs, "1" or "2")
 * are the exterior colour list, formatted as:
 *
 *     C#KH3           SUPER BLACK
 *     C#5H6           WHITE /GOLD(#KG5/#656)
 *
 * i.e. a 15-character code field holding "#" + the three-character paint code,
 * followed by a 40-character English description. Two-tone paints get their own
 * three-character code whose description names the two constituent codes.
 *
 * This is the same source Nissan's own parts counter reads from, so it beats
 * any secondary paint-code list: it is per-disc, era-correct, and matches the
 * codes actually present in the VIN data.
 *
 * Output: public/data/paint.json  ({ "KH3": "Super Black", ... })
 *
 * Run: node extract_paint.js
 */

const fs = require('fs');
const path = require('path');

const ROOTS = ['H:/AR-JP', 'H:/NISSAN', 'H:/INF-ALL'];
const REPO = __dirname;
const OUT = path.join(REPO, 'public', 'data', 'paint.json');

const dec = new TextDecoder('shift_jis');

// ---------------------------------------------------------------------------
// 1. Which paint codes does the site actually use?
//    The colour field in the VIN data is [1 interior-trim char][3 paint chars];
//    older JDM records leave the trim character blank, which is why the same
//    paint shows up as both "KH3" and "GKH3". Only the 3-char tail is paint.
// ---------------------------------------------------------------------------
function paintBase(code) {
  return code.length === 4 ? code.slice(1) : code;
}

// R31 (HR31) and R30 (DR30) sit in data/ but are deliberately not loaded by the
// site — see the scope note at the top of database.js. Their colours would
// otherwise show up here as "missing names" for paints nothing ever displays.
const NOT_LOADED = /^fast_(dr30|hr31)\.json$/;

function codesInUse() {
  const dir = path.join(REPO, 'public', 'data');
  const used = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!/^fast_.*\.json$/.test(f)) continue;
    if (NOT_LOADED.test(f)) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, ''));
    if (!Array.isArray(doc.c) || !Array.isArray(doc.r)) continue;
    const tally = new Array(doc.c.length).fill(0);
    for (const row of doc.r) tally[row[3]]++;
    doc.c.forEach((code, i) => {
      const b = paintBase(code);
      used.set(b, (used.get(b) || 0) + tally[i]);
    });
  }
  return used;
}

// ---------------------------------------------------------------------------
// 2. Harvest every colour record from every ABBREV table on the discs.
// ---------------------------------------------------------------------------
function harvest() {
  // Two record shapes carry the same table:
  //   JP discs (binary)  — control bytes, category char "C"/"1"/"2", code, description
  //   export ABBR.TXT    — plain lines that simply start with the "#" code
  // Some codes also carry their two-tone composition inside the code field, as
  // "#5S5(WK1/KR4)", so the parenthetical is consumed before the padding.
  const SHAPES = [
    /[\x00-\x1F]{1,2}[C12]#([0-9A-Z]{3})(?:\([^)\x00-\x1F]*\))?\s{2,}([A-Z0-9][^\x00-\x1F]{1,43})/g,
    /(?:^|\r?\n)#([0-9A-Z]{3})(?:\([^)\r\n]*\))?\s{2,}([A-Z0-9][^\r\n]{1,43})/g
  ];
  const votes = new Map();   // code -> Map(name -> times seen)
  let files = 0;

  const walk = (d, depth) => {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, depth + 1); continue; }
      if (!/^(ABBREV\.|ABBR\.TXT)/i.test(e.name)) continue;
      let text;
      try { text = dec.decode(fs.readFileSync(p)); } catch (err) { continue; }
      files++;
      for (const re of SHAPES) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text))) {
          const code = m[1];
          const name = m[2].trim().replace(/\s+/g, ' ');
          if (name.length < 3) continue;
          if (!votes.has(code)) votes.set(code, new Map());
          const g = votes.get(code);
          g.set(name, (g.get(name) || 0) + 1);
        }
      }
    }
  };
  ROOTS.forEach(r => walk(r, 0));
  return { votes, files };
}

// ---------------------------------------------------------------------------
// 3. Turn Nissan's shorthand into something readable without inventing detail.
//    Only the finish suffixes that appear unambiguously across the discs get
//    expanded; anything else is passed through as-is rather than guessed at.
// ---------------------------------------------------------------------------
const FINISH = [
  [/\s*\(?\bPM\)?$/,  ' (Pearl Metallic)'],
  [/\s*\(?\b3P\)?$/,  ' (3-Stage Pearl)'],
  [/\s*\(?\b2P\)?$/,  ' (2-Stage Pearl)'],
  [/\s*\(?\bTPM\)?$/, ' (Tinted Pearl Metallic)'],
  [/\s*\(?\bP\)?$/,   ' (Pearl)'],
  [/\s*\(?\bM\)?$/,   ' (Metallic)'],
  [/\s*\(?\bS\)?$/,   ' (Solid)']   // "BLACK S" also appears spelled "BLACK SOLID"
];

// Many disc entries append the window the name applied to — "DARK GRAY <FROM
// JUL. 1992>", "WHITE PEARL <FROM SEP.'91 TO SEP.'93>". The window belongs to
// the disc revision, not the colour, so it is dropped rather than displayed.
function stripQualifier(s) {
  return s.replace(/\s*<[^>]*>\s*$/, '')
          .replace(/\s*\((?:UP TO|FROM)\b[^)]*\)\s*$/i, '')
          .trim();
}

// ---------------------------------------------------------------------------
// Curated names.
//
// The discs are authoritative but terse: they mostly record the generic factory
// reading ("BLACK S", "SILVER M") and only occasionally the marketing name a
// car is actually known by. Where a colour has a well-established Nissan name
// confirmed by more than one independent published source, and the code's use
// inside this archive is confined to the models those sources cover, the
// marketing name wins — it is the same paint, described better.
//
// Deliberately NOT overridden: codes whose marketing name is era- or
// model-specific in a way that would mislabel our records. KY0 is "Z-tune
// Silver" only on the Nismo Z-tune; every KY0 car in this archive is an M35
// Stagea, so it keeps the disc's plain "Silver (Metallic)". AN0 is "Wine Red"
// on R32 but "Super Clear Red" on R33 — every AN0 record here is R33-family or
// S14, so the R33 name is the correct one.
//
// Sources: skylinebible.blogspot.com colour-code list and 2009gtr.com GT-R
// paint-code guide (independent, in agreement); paintscratch.com and
// importarchive.com for the S13/Z32-era codes.
const OVERRIDES = {
  // S15-era. BN5 is the one name in this table with NO disc behind it.
  //
  // Adding the S15 brought in 237 records painted BN5, and the colour master
  // does not have it: all 196 ABBREV tables on the discs were searched and
  // none carries a #BN5 record. Enthusiast sources give Light Bluish Silver,
  // with some calling the same colour Aqua Silver.
  //
  // So this is corroborated rather than sourced, the same footing as the R33
  // two-tones 1N3 and 1N4 and marked as such wherever confidence is reported.
  // Every other entry here is a disc-backed correction; this one is not.
  BN5: 'Light Bluish Silver',

  // R32-era, also shared with S13 / Z32
  KH2: 'Gun Grey Metallic',
  KG1: 'Jet Silver Metallic',
  TH1: 'Dark Blue Pearl',
  AH3: 'Cherry Red Pearl',
  KL0: 'Spark Silver Metallic',
  '326': 'Crystal White',
  '732': 'Black Pearl Metallic',
  // R33-era
  KH3: 'Super Black',
  AN0: 'Super Clear Red',
  AR1: 'Super Clear Red II',
  BN6: 'Deep Marine Blue',
  LP2: 'Midnight Purple',
  KN6: 'Dark Grey Pearl',
  QM1: 'White',
  // R34-era, also shared with C34 / M35
  KR4: 'Sonic Silver',
  TV2: 'Bayside Blue',
  GV1: 'Black Pearl',
  KV2: 'Athlete Silver',
  AR2: 'Active Red',
  EV1: 'Lightning Yellow',
  LV4: 'Midnight Purple II',
  LX0: 'Midnight Purple III',
  WV2: 'Sparkling Silver',
  QX1: 'White Pearl',
  EY0: 'Silica Breath',

  // Corrections where a single disc entry is contradicted by the published
  // record. Both of these rest on ONE vote, from H:/AR-JP/JP/ABBR.TXT, and both
  // read as a bare colour word that is simply the wrong colour:
  //
  //   TG0 was "Blue" on 27,321 records. Nissan's own R32 touch-up paint for TG0
  //   is Grey Metallic, and gtr-registry's R32 colour list has Light Grey
  //   Metallic. A grey car was being described as blue.
  //   JK0 was "Silver" on 251 records against Yellowish Green Metallic in the
  //   same list.
  TG0: 'Light Grey Metallic',
  JK0: 'Yellowish Green Metallic',

  // Held at the era-correct name. Preferring the most specific disc entry
  // otherwise promotes "Glacier White Pearlglow" here, which is a 2000s Nissan
  // colour; every KH6 record in this archive is a Z32 or an R32, and both
  // gtr-registry's R32 list and the Z32 sources call KH6 Pearl White.
  KH6: 'Pearl White',

  // Marketing names the discs themselves carry, chosen over the bare reading
  // because nothing in any table scopes them to a date range. Both are used by
  // S13/S14/Z32-era records only.
  //   AG2 is "RED" nine times and "AZTEC RED" five, no qualifier on either.
  //   WK0 is "WHITE" four times and "ASPEN WHITE PEARL" once — a single vote,
  //   but unqualified, and it is the name these cars are sold under.
  AG2: 'Aztec Red',
  WK0: 'Aspen White Pearl',

  // Deliberately NOT overridden, though a marketing name exists on the discs:
  // AJ4, TK3 and K23 were RENAMED mid-production and the tables say so —
  // AJ4 "RED <UP TO OCT.1994>" then "ULTRA RED <FROM OCT.1994>", TK3
  // "BLUE PEARL GRAPHITE <UP TO OCT.1994>" then "SAPPHIRE BLUE <FROM OCT.1994>",
  // K23 through Brilliant Silver, Liquid Platinum and Platinum Ice. This
  // archive's records straddle those dates, so a single marketing name would be
  // wrong for roughly half of them. The dominant generic reading is the only
  // one true across the whole run. Naming these properly needs the paint table
  // to become date-aware, which is a bigger change than this file.

  // The R34's famous green. The discs and the paint trade both record the
  // generic reading — "YELLOWISH GREEN M." is exactly how suppliers list it —
  // but Nissan's name for it is Millennium Jade, and that is what the car is
  // known by. Every JW0 record in this archive is an R34.
  JW0: 'Millennium Jade',

  // Two-tone codes carried by real records that no disc in this set names.
  // Both are R33 combinations; the composition below is the reading multiple
  // owner-forum sources agree on, and the archive corroborates the era: every
  // 1N3 record falls inside the Series 1 window (Feb 1993 - Nov 1994) those
  // sources say it was limited to. Flagged as lower-confidence in the docs.
  '1N4': 'Two-Tone Silver / Grey (#KL0 / #KM1)',
  '1N3': 'Two-Tone Blue-Green / Grey'
};

function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

// Tidy the disc's typography without changing what it says: expand its one
// common abbreviation, space out slashes and brackets, and settle on a single
// spelling of grey so curated and disc-derived names read alike.
function tidy(s) {
  return s
    .replace(/\bDk\b/g, 'Dark')
    .replace(/\bGray\b/g, 'Grey')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*\(/g, ' (')
    .replace(/\(\s+/g, '(')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function prettify(input) {
  const raw = stripQualifier(input);
  // Composite two-tone descriptions keep their referenced codes verbatim.
  if (/#/.test(raw)) {
    return tidy(titleCase(raw)).replace(/#([0-9a-z]{3})/gi, (_, c) => '#' + c.toUpperCase());
  }
  let name = raw, suffix = '';
  for (const [re, rep] of FINISH) {
    if (re.test(name)) { name = name.replace(re, ''); suffix = rep; break; }
  }
  return tidy(titleCase(name.trim()) + suffix);
}

// Prefer the reading the discs agree on most often; break ties toward the more
// descriptive string so "Garnet Fire" wins over a bare "Red". Date-qualified
// spellings are folded into their unqualified form first, so "DARK GRAY" and
// "DARK GRAY <FROM JUL. 1992>" count as votes for the same name instead of
// splitting and letting a rarer variant win.
// A name that is nothing but a colour word, optionally with a finish suffix:
// "RED", "WHITE 3P", "BLUE M", "BLACK SOLID". These are what the JDM discs
// mostly carry, and they are true but uninformative.
const BARE = /^(?:VERY |DARK |LIGHT |DEEP |BRIGHT |PALE |GRAYISH |GREYISH |BLUISH |REDDISH |YELLOWISH |GREENISH |BROWNISH |PURPLISH )*(?:WHITE|BLACK|SILVER|GRAY|GREY|RED|BLUE|GREEN|YELLOW|BROWN|BEIGE|GOLD|PURPLE|ORANGE|PINK|IVORY|CHAMPAGNE)(?:\s+(?:M|P|S|3P|2P|PM|TPM|SOLID|METALLIC|PEARL|MICA))*$/i;

// Pick the name that says the most, not the one repeated most often.
//
// Frequency was the original rule and it is systematically wrong here: a bare
// factory reading like "RED" appears on every disc that lists the code, while
// the marketing name appears on the handful that bother. Voting therefore
// selects the LEAST informative variant every time. AG2 is "RED" nine times and
// "AZTEC RED" five; WK0 is "WHITE" four times and "ASPEN WHITE PEARL" once.
//
// So: if any variant is more than a bare colour word, choose among those (by
// support, then length) and ignore the bare ones. Only if every variant is bare
// does frequency decide.
function bestName(variants) {
  const folded = new Map();
  for (const [name, n] of variants) {
    const key = stripQualifier(name);
    if (key.length < 3) continue;
    folded.set(key, (folded.get(key) || 0) + n);
  }
  const pool = folded.size ? folded : variants;
  let all = [...pool.entries()];

  // Throw out variants the disc mangled before preferring anything for being
  // long. The description field is capped at 43 characters, so an entry with a
  // date window on the end gets cut mid-qualifier: B21 reads "FOUNTAIN BLUE PM
  // (FROM AUG.2004 UP TO AUG.20" with no closing bracket, which stripQualifier
  // cannot match and which must never win on length.
  const malformed = ([name]) => {
    const opens = (name.match(/\(/g) || []).length;
    const closes = (name.match(/\)/g) || []).length;
    if (opens !== closes) return true;
    if (/\b(?:FROM|UP TO)\b/i.test(name)) return true;
    return false;
  };
  const clean = all.filter(v => !malformed(v));
  if (clean.length) all = clean;

  // Support decides, not length.
  //
  // Preferring the most specific variant was tried and abandoned. It fixes the
  // obvious cases — AG2 "RED" x9 against "AZTEC RED" x5 — but breaks more than
  // it mends, because the rare variants are usually rare for a reason: they are
  // era-specific renames. The discs record AY2 as "RED PM (UP TO AUG. 2004)"
  // and then "GARNET FIRE-PM (FROM AUG. 2004)", KY0 as "SILVER M" 42 times and
  // "BRILLIANT SILVER-M (FROM AUG. 2004)" once. Promoting the rare name applies
  // a 2004 rename to cars built in 2001. The dominant reading is the one that
  // holds across the whole production run, so it wins, and the handful of codes
  // whose marketing name is genuinely better and genuinely era-safe are listed
  // in OVERRIDES above with their sources.
  return all.sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length))[0][0];
}

// ---------------------------------------------------------------------------
function main() {
  const used = codesInUse();
  const { votes, files } = harvest();
  console.log(`Scanned ${files} ABBREV tables; ${votes.size} colour codes found on disc.`);
  console.log(`Site uses ${used.size} distinct paint codes.`);

  // Keep any hand-curated name already in paint.json that the discs don't cover.
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(OUT, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) { /* first run */ }

  const out = {};
  const missing = [];
  let overridden = 0;
  for (const code of [...used.keys()].sort()) {
    if (OVERRIDES[code]) { out[code] = OVERRIDES[code]; overridden++; }
    else if (votes.has(code)) out[code] = prettify(bestName(votes.get(code)));
    else if (existing[code]) out[code] = tidy(existing[code]);
    else missing.push([code, used.get(code)]);
  }
  // Curated names for codes this archive doesn't currently carry still belong
  // in the table, so adding a chassis later doesn't silently lose them.
  for (const [code, name] of Object.entries(OVERRIDES)) {
    if (!out[code]) out[code] = name;
  }
  // Carry forward curated entries for codes not currently in the data, so the
  // table stays useful if new chassis are added later.
  for (const [code, name] of Object.entries(existing)) {
    if (!out[code]) out[code] = tidy(name);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

  const covered = [...used.keys()].filter(c => out[c]).length;
  const recordsCovered = [...used.entries()].filter(([c]) => out[c]).reduce((a, x) => a + x[1], 0);
  const recordsTotal = [...used.values()].reduce((a, b) => a + b, 0);
  console.log(`Wrote ${Object.keys(out).length} names to ${path.relative(REPO, OUT)}.`);
  console.log(`In-use coverage: ${covered}/${used.size} codes (${overridden} curated), ` +
    `${recordsCovered.toLocaleString()}/${recordsTotal.toLocaleString()} records ` +
    `= ${(recordsCovered / recordsTotal * 100).toFixed(2)}%.`);
  if (missing.length) {
    console.log('\nNo factory name on disc for:');
    missing.sort((a, b) => b[1] - a[1])
      .forEach(([c, n]) => console.log(`  ${c}  ${n.toLocaleString()} records`));
  }
}

main();
