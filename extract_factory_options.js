// extract_factory_options.js - the FASTOP option legend, read from the disc.
//
// WHY THIS EXISTS
//
// public/data/factoryOptions.json was generated once and never checked against
// its source. It shipped 462 of the 678 option definitions FASTOP actually
// holds for the four generations that use it, and the 216 it dropped were not
// a random sample: they were every OPEN-ENDED validity window, which is to say
// the last window of each generation - the newest cars in each family.
//
// The cost of that, before this ran:
//
//   S14   20,340 option characters undecodable, 84% of every remaining gap in
//         the archive. Recorded in docs as "blocked at source - FASTOP stops
//         at 9606". FASTOP does not stop at 9606; it OPENS a window there,
//         with 67 codes in it, covering every S14 built from mid-1996 to the
//         end of production.
//   R34   the [200008- ] window was hand-transcribed from volume 081's option
//         pages into a _r34Late table in database.js, page by page, because
//         FASTOP was believed not to have it. It has it - all 61 codes.
//   R33   55 codes from [9710- ].
//   WC34  33 codes from [9808- ].
//
// The lesson worth keeping is that the failure was silent in both directions:
// the extractor dropped records without erroring, and the audit that should
// have caught it counted an `undecoded: true` placeholder as a successful
// decode, so the site reported 100% option coverage on R34 while 1,596
// characters showed as unknown to visitors.
//
// RECORD FORMAT (63 bytes, fixed)
//
//   +0   4   record prefix
//   +4   6   chassis code, space padded         "S14   "
//   +10  8   validity window, YYMM + YYMM       "93109505"
//            The second half is BLANK for an open-ended window: "9606    ".
//            Parsing that as a number gives 0 or NaN and the record looks
//            invalid - this is the bug that cost 216 definitions.
//            Years are two digits and wrap: "0008" is 2000-08, not 1900-08.
//   +18  6   option mask. Five slots for plate positions 14-18 plus a line
//            tag. The letter's INDEX in the five slots IS the position:
//            "F****" is plate 14, "*A***" 15, "**A**" 16, "***A*" 17,
//            "****A" 18.
//   +24  35  description text, Shift-JIS, space padded
//   +55  2   a flag field, not text. It carries "AB" on airbag entries.
//            Reading the text as 39 bytes swallows it and produces strings
//            like "ABS         AB" and "ﾌｪﾝﾀﾞABｰﾐﾗｰ" - text with a two-letter
//            code injected into the middle of a word.
//   +57  2   padding
//
// THE LINE TAG decides what a record IS, and it is not a simple counter:
//   digits 1,2,3   continuation lines of the DESCRIPTION. Long descriptions
//                  wrap at the 35-byte boundary, mid-word, so "ﾘﾔﾜｲﾊﾟ" and
//                  "ｰ" are two records that must be concatenated in tag order.
//   letters        a DIFFERENT column - the grade the option applies to
//                  ("'s標準仕様", "K's ﾊｲｷｬｽ無ﾀｲﾌﾟS"). Not part of the
//                  feature description. Concatenating these onto the text is
//                  how "ｴｱｺﾝﾚｽ" becomes "ｴｱｺﾝﾚｽ's標準仕様".
// Only digit-tagged lines are description. That is not a guess: it is what
// reproduces the English already shipped for the 462 known entries.
//
// RECORDS ARE NOT ON A FIXED GRID. Striding 63 bytes from any single anchor
// finds some records and misses others - one such stride found 24 of the 33
// S14 records in one window and reported the rest as absent. This scans every
// byte offset and validates the shape, which is slower and complete.
//
// TRANSLATION
//
// Descriptions are half-width katakana joined with "+", and the site's
// convention - set by the entries already shipped - is to translate each term
// and rejoin with " + ". So this keeps a term dictionary rather than a
// per-string one: 232 terms cover all 678 options, and a new window usually
// introduces only a handful of new terms.
//
// ENTRIES THAT ALREADY SHIPPED ARE NEVER RETRANSLATED. Their English is
// carried through verbatim, keyed by chassis/window/position/character. This
// script can only ADD. That way a wording choice made here cannot silently
// rewrite text that is already live and already checked.
//
// USAGE
//   node extract_factory_options.js            report, write nothing
//   node extract_factory_options.js --write    rewrite public/data/factoryOptions.json

'use strict';
const fs = require('fs');
const path = require('path');

const SRC = 'H:/AR-JP/JP/FASTOP';
const REPO = __dirname;
const OUT = path.join(REPO, 'public', 'data', 'factoryOptions.json');
const REC = 63;

// The generations whose options the site reads from FASTOP. R32, S13, Z32 and
// S15 are decoded from their own volumes' option pages instead and are absent
// from this file entirely.
const GENS = ['R33', 'R34', 'S14', 'WC34'];

// ---------------------------------------------------------------------------
// Phrases that must survive the "+" split.
//
// "運転席+助手席ｴｱﾊﾞｯｸﾞ" is ONE feature - driver and passenger airbags - that
// happens to be written with a plus. Splitting it yields "運転席" (driver's
// seat) as a standalone feature, which is not what the car has.
const PHRASES = [
  ['運転席+助手席ｴｱﾊﾞｯｸﾞ', 'driver and passenger airbags'],
  ['運転席/助手席ｴｱﾊﾞｯｸﾞ', 'driver and passenger airbags'],
  ['運転席･助手席ｴｱﾊﾞｯｸﾞ', 'driver and passenger airbags']
];

// ---------------------------------------------------------------------------
// Term dictionary. Spelling variants are listed separately rather than
// normalised: the file uses both "ｰ" and "-" as the long-vowel mark and both
// appear in meaningful names ("GTS-4" against "GTSｰ4仕様"), so collapsing them
// would corrupt a grade name to fix a typo.
const TERMS = {
  // safety and driveline
  'ABS': 'ABS',
  'ﾋﾞｽｶｽLSD': 'viscous LSD',
  'ﾘﾔﾋﾞｽｶｽLSD': 'rear viscous LSD',
  'ﾘﾔﾍﾘｶﾙLSD': 'rear helical LSD',
  'ﾋﾞｽｶｽLSD(ﾘﾐﾃｯﾄﾞｽﾘｯﾌﾟﾃﾞﾌ)': 'viscous LSD (limited slip differential)',
  'LSD(ﾘﾐﾃｯﾄﾞｽﾘｯﾌﾟﾃﾞﾌ)': 'LSD (limited slip differential)',
  'LSD(ﾘﾐﾃｯｯﾄﾞｽﾘｯﾌﾟﾃﾞﾌ)': 'LSD (limited slip differential)',
  'ﾋﾞｽｶｽLSD(GTS25TﾀｲﾌﾟM 40THｱﾆﾊﾞｰｻﾘｰは標準装備)':
    'viscous LSD (standard equipment on GTS25T type M 40th Anniversary)',
  '運転席ｴｱﾊﾞｯｸﾞ': 'driver airbag',
  '助手席ｴｱﾊﾞｯｸﾞ': 'passenger airbag',
  '助手席ｴｱﾊﾞｯｸ': 'passenger airbag',
  'ｻｲﾄﾞｴｱﾊﾞｯｸﾞ': 'side airbags',
  'ｻｲﾄﾞｴｱﾊﾞｯｸ': 'side airbags',
  '40THｱﾆﾊﾞｰｻﾘｰｻｲﾄﾞｴｱﾊﾞｯｸﾞ': '40th Anniversary side airbags',
  'ﾘﾔ中央３点式ﾍﾞﾙﾄ': 'rear centre three-point seatbelt',
  'ﾘﾔ中央３Pﾍﾞﾙﾄ': 'rear centre three-point seatbelt',
  '中央３点式ﾍﾞﾙﾄ': 'centre three-point seatbelt',
  '中央3点式ﾍﾞﾙﾄ': 'centre three-point seatbelt',
  '大型RRﾌﾞﾚｰｷ': 'large rear brakes',

  // paint and glass
  'ｽｰﾊﾟｰﾊｰﾄﾞｺｰﾄ': 'Super Hard Coat paint',
  'ｽｰﾊﾟｰﾌｧｲﾝｺｰﾄ': 'Super Fine Coat paint',
  'ｽｰﾊﾟｰﾌｧｲｺｰﾄ': 'Super Fine Coat paint',
  'ｽｰﾊﾟｰﾌｧｲﾝｺｰﾃｨﾝｸﾞ': 'Super Fine Coating paint',
  'ｽｰﾊﾟｰﾌｧｲﾝｺｰﾄ(ﾌｯ素塗装)': 'Super Fine Coat paint (fluororesin)',
  'ｽｰﾊﾟｰﾌｧｲﾝﾊｰﾄﾞｺｰﾄ': 'Super Fine Hard Coat paint',
  'ｽﾊﾟｰﾌｧｲﾝﾊｰﾄﾞｺｰﾄ': 'Super Fine Hard Coat paint',
  'ｽｰﾊﾟｰﾌｧｲﾝﾊｰﾄﾞｺｰﾄﾚｽ': 'Super Fine Hard Coat paint delete',
  'ｽｰﾊﾟｰﾌｧｲﾝﾊ-ﾄﾞｺｰﾄﾚｽ': 'Super Fine Hard Coat paint delete',
  'SFC': 'Super Fine Coat paint',
  'ﾌｯ素樹脂塗装': 'fluororesin paint',
  'ﾌﾟﾗｲﾊﾞｼｰｶﾞﾗｽ': 'privacy glass',
  'UVｶｯﾄ断熱ｶﾞﾗｽ': 'UV-cut insulating glass',
  'UVｶｯﾄ断熱ｸﾞﾘｰﾝｶﾞﾗｽ': 'UV-cut insulating green glass',
  'UVｶｯﾄｶﾞﾗｽ': 'UV-cut glass',
  'UVｶｯﾄ断熱ｶﾞﾗｽ＋ﾌﾟﾗｲﾊﾞｼｰｶﾞﾗｽ': 'UV-cut insulating glass + privacy glass',
  'ﾛﾝｸﾞﾗｲﾌ撥水ｶﾞﾗｽ': 'long-life water-repellent glass',
  '外板色#WK1専用新内装色': 'new interior colour exclusive to exterior colour #WK1',
  'ﾐｯﾄﾞﾅｲﾄﾊﾟｰﾌﾟﾙ III 仕様': 'Midnight Purple III specification',
  'ﾂｰﾄﾝWﾗｯｾﾙｼﾖｳ': 'two-tone double-raschel trim specification',

  // roof
  'ｻﾝﾙｰﾌ': 'sunroof',
  '電動ｶﾞﾗｽｻﾝﾙｰﾌ': 'electric glass sunroof',
  '電動ｶﾞﾗｽﾂｲﾝｽﾗｲﾄﾞｻﾝﾙｰﾌ': 'electric glass twin sliding sunroof',

  // wheels and tyres
  '15ｲﾝﾁｱﾙﾐﾎｲｰﾙ': '15-inch alloy wheels',
  '16ｲﾝﾁｱﾙﾐﾎｲｰﾙ': '16-inch alloy wheels',
  '16ｲﾝﾁ鍛造ｱﾙﾐﾎｲｰﾙ': '16-inch forged alloy wheels',
  '16ｲﾝﾁｽﾁｰﾙﾎｲｰﾙ': '16-inch steel wheels',
  'ｱﾙﾐﾎｲｰﾙ': 'alloy wheels',
  '15ｲﾝﾁｱﾙﾐﾛｰﾄﾞﾎｲｰﾙ(ｷｰ付)': '15-inch alloy road wheels (with lock keys)',
  '15ｲﾝﾁｱﾙﾐﾛｰﾄﾞﾎｲｰﾙ(ｷｰ無し)': '15-inch alloy road wheels (without lock keys)',
  '16ｲﾝﾁｱﾙﾐﾛｰﾄﾞﾎｲｰﾙ': '16-inch alloy road wheels',
  '15ｲﾝﾁｽﾁｰﾙﾛｰﾄﾞﾎｲｰﾙ': '15-inch steel road wheels',
  'ﾀｲﾔ': 'tyres',
  '15ｲﾝﾁﾀｲﾔ': '15-inch tyres',
  '205 R15ﾀｲﾔ': '205 R15 tyres',
  '205R15ﾀｲﾔ': '205 R15 tyres',
  '205/60R15ﾀｲﾔ&15ｲﾝﾁｱﾙﾐﾎｲｰﾙ': '205/60R15 tyres and 15-inch alloy wheels',
  '205/60R15ﾀｲﾔ&15ｲﾝﾁｱﾙﾐ': '205/60R15 tyres and 15-inch alloys',
  'ﾌﾙｶﾊﾞｰ': 'full wheel covers',
  'ｾﾝﾀｰｷｬｯﾌﾟ': 'centre caps',

  // lamps and mirrors
  'ﾌﾛﾝﾄﾌｫｸﾞﾗﾝﾌﾟ': 'front fog lamps',
  'ﾌｫｸﾞﾗﾝﾌﾟ': 'fog lamps',
  'ﾘﾔﾌｫｸﾞﾗﾝﾌﾟ': 'rear fog lamp',
  'ｷｾﾉﾝﾍｯﾄﾞﾗﾝﾌﾟ': 'xenon headlamps',
  'ｽﾎﾟｯﾄﾗﾝﾌﾟ': 'spot lamp',
  'ｺｰﾅﾘﾝｸﾞﾗﾝﾌﾟ': 'cornering lamps',
  'ｺ-ﾅﾘﾝｸﾞﾗﾝﾌﾟ': 'cornering lamps',
  'ｵｰﾄﾗｲﾄ': 'automatic headlamps',
  'ｸﾞﾛｰﾌﾞﾎﾞｯｸｽﾗｲﾄ': 'glovebox lamp',
  'Gﾎﾞｯｸｽﾗｲﾄ': 'glovebox lamp',
  'ﾌｪﾝﾀﾞｰﾐﾗｰ': 'fender mirrors',
  '運転席ﾊﾞﾆﾃｨﾐﾗｰ': 'driver vanity mirror',
  'DRﾊﾞﾆﾃｨｰﾐﾗｰ': 'driver vanity mirror',

  // wipers and entry
  'ﾘﾔﾜｲﾊﾟｰ': 'rear wiper',
  'ﾘﾔﾜｲﾊﾟ-': 'rear wiper',
  'ﾘﾔﾜｲﾊﾟｰ(ｴｱﾛｾﾚｸｼｮﾝ)': 'rear wiper (Aero Selection)',
  'GTR:ﾘﾔﾜｲﾊﾟｰ': 'rear wiper (GT-R)',
  'UVｶｯﾄ断熱ｶﾞﾗｽGTR除く:ﾘﾔﾜｲﾊﾟｰ': 'UV-cut insulating glass, rear wiper except GT-R',
  '無段間欠ﾜｲﾊﾟｰ': 'variable intermittent wipers',
  '2速無段間欠ﾜｲﾊﾟｰ': '2-speed variable intermittent wipers',
  '2速無段断間欠ﾜｲﾊﾟｰ': '2-speed variable intermittent wipers',
  'ｷｰﾚｽｴﾝﾄﾘｰ': 'keyless entry',
  'ﾘﾓｺﾝｴﾝﾄﾘｰ': 'remote control entry',
  'ﾘﾓｰﾄｺﾝﾄﾛｰﾙｴﾝﾄﾘｰ': 'remote control entry',
  'ﾘﾓｰﾄｺﾝﾄﾛｰﾙｴﾝﾄﾘｰｼｽﾃﾑ': 'remote control entry system',
  'ﾘﾓ-ﾄｺﾝﾄﾛ-ﾙｴﾝﾄﾘ-ｼｽﾃﾑ': 'remote control entry system',
  'ﾘﾓｰﾄｺﾝﾄﾛｰﾙｼｽﾃﾑ': 'remote control system',

  // climate
  'ﾏﾆｭｱﾙｴｱｺﾝ': 'manual air conditioning',
  'ｵｰﾄｴｱｺﾝ': 'automatic climate control',
  'ｴｱｺﾝﾚｽ': 'air conditioning delete',

  // audio, instruments, navigation
  'ｵｰﾃﾞｨｵ': 'audio',
  'ｵｰﾃﾞｨｵﾚｽ': 'audio delete',
  'ｵｰﾃﾞｨｵﾚｽ仕様': 'audio delete specification',
  '2DIN CD 6ｽﾋﾟｰｶｰ': '2-DIN CD, six speakers',
  '2DIN TV 6ｽﾋﾟｰｶｰ': '2-DIN TV, six speakers',
  '2DINｵｰﾃﾞｨｵ': '2-DIN audio',
  '2DINｵｰﾃﾞｨｵ6SP': '2-DIN audio, six speakers',
  '2DIN8SP': '2-DIN, eight speakers',
  '120W6SP': '120W, six speakers',
  '200W8SP': '200W, eight speakers',
  '1DIN': '1-DIN',
  'TV機能': 'television',
  'ﾅﾋﾞ': 'navigation',
  'ﾅﾋﾞｹﾞｰｼｮﾝｼｽﾃﾑ': 'navigation system',
  'NAVIｴﾃﾞｨｼｮﾝ': 'NAVI Edition',
  '100Vｲﾝﾊﾞｰﾀｰ': '100V inverter',
  'MD一体AM/FMﾗｼﾞｵ': 'AM/FM radio with integrated MD',
  'ｶｾｯﾄ一体型AM/FMﾗｼﾞｵ': 'AM/FM radio with integrated cassette',
  'MDﾌﾟﾚｰﾔｰ': 'MD player',
  'CDｵｰﾄﾁｪﾝｼﾞｬｰ': 'CD autochanger',
  'ｺﾝﾋﾞｽﾃﾚｵ': 'combination stereo',
  'AVｼｽﾃﾑ': 'AV system',
  'ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑ': 'Kenwood Sound Cruising System',
  'ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑ(8ｽﾋﾟｰｶｰ)': 'Kenwood Sound Cruising System (eight speakers)',
  'ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑ8ｽﾋﾟｰｶｰ': 'Kenwood Sound Cruising System, eight speakers',
  'ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑﾀｲﾌﾟCD': 'Kenwood Sound Cruising System, CD type',
  'ｽｶｲﾗｲﾝｻｳﾝﾄﾞｼｽﾃﾑ': 'Skyline Sound System',
  'ｽｶｲﾗｲﾝｽｰﾊﾟｰｻｳﾝﾄﾞｼｽﾃﾑ(6SP)': 'Skyline Super Sound System (six speakers)',
  'ｽｶｲﾗｲﾝｽｰﾊﾟｰｻｳﾝﾄﾞｼｽﾃﾑII': 'Skyline Super Sound System II',
  'ｽｰﾊﾟｰｻｳﾝﾄﾞｼｽﾃﾑ': 'Super Sound System',
  'ﾀﾞｲﾊﾞｰｼﾃｨﾚｽ標準ｵｰﾃﾞｨｵ': 'standard audio without diversity antenna',
  'ﾎﾜｲﾄﾒｰﾀｰ': 'white instrument dials',
  'ﾌﾞｰｽﾄﾒｰﾀｰ': 'boost gauge',
  'ﾏﾙﾁﾃﾞｨｽﾌﾟﾚｲﾒｰﾀｰ': 'multi-display meter',
  'ﾌﾛﾝﾄｳｲﾝﾄﾞｳﾃﾞｨｽﾌﾟﾚｲ': 'head-up display',
  'ｲﾙﾐﾈｰｼｮﾝｺﾝﾄﾛｰﾙ': 'illumination control',
  'ASCD': 'cruise control',

  // interior
  'ｴｸｾｰﾇｼｰﾄ': 'Excaine seat trim',
  'ｽﾎﾟｰﾂｼｰﾄ': 'sports seats',
  'ｽﾎﾟｰﾂﾀｲﾌﾟｼｰﾄ': 'sports-type seats',
  'ｽﾎﾟｰﾂﾊﾟｯｹｰｼﾞｼｰﾄ': 'Sports Package seats',
  'SEﾘﾐﾃｯﾄﾞ用ｼｰﾄ': 'SE Limited seats',
  'ﾄﾘｺｯﾄｼｰﾄ': 'tricot seat trim',
  'ﾄﾘｺｯﾄｼｰﾄｼﾖｳ': 'tricot seat specification',
  'ｴｱﾛ用ｼｰﾄ地': 'Aero seat fabric',
  '黒ｸﾞﾚｰｼｰﾄ地': 'black and grey seat fabric',
  '本革ｻﾌﾟﾗｰﾚｺﾝﾋﾞｼｰﾄ': 'leather and Supplale combination seats',
  '本皮ｻﾌﾟﾗｰﾚｺﾝﾋﾞｼｰﾄ(ﾌﾟﾗｲﾑｴﾃﾞｨｼｮﾝ･ﾀｰﾎﾞ系)':
    'leather and Supplale combination seats (Prime Edition, turbo models)',
  '両席ﾊﾟﾜｰｼｰﾄ': 'power seats, both front seats',
  '40THｱﾆﾊﾞｰｻﾘｰ専用ｼｰﾄ･4ﾄﾞｱ': '40th Anniversary seats, 4-door',
  '40THｱﾆﾊﾞｰｻﾘｰ専用ｼｰﾄ･2ﾄﾞｱ': '40th Anniversary seats, 2-door',
  '本革ｽﾃｱﾘﾝｸﾞ': 'leather steering wheel',
  '革巻ｽﾃｱﾘﾝｸﾞ(MT車)': 'leather-wrapped steering wheel (manual)',
  '本革ｽﾃｱﾘﾝｸﾞPKBﾉﾌﾞ,ｼﾌﾄﾉﾌﾞ': 'leather steering wheel, handbrake grip and shift knob',
  '本革仕様': 'leather specification',
  '本革仕様(ｽﾃｱﾘﾝｸﾞ､ｼﾌﾄﾉﾌﾞ)': 'leather specification (steering wheel and shift knob)',
  'ﾓﾓｶﾜﾏｷ仕様': 'Momo leather-wrapped specification',
  'ｳﾚﾀﾝｽﾃｱﾘﾝｸﾞｼﾖｳ': 'urethane steering wheel specification',
  'ｽﾎﾟｰﾂﾀｲﾌﾟｽﾃｱﾘﾝｸﾞﾚｽ': 'sports-type steering wheel delete',
  'ｽﾎﾟｰﾂﾀｲﾌﾟｼﾌﾄﾉﾌﾞ(AT車)': 'sports-type shift knob (automatic)',
  'ｽﾎﾟｰﾂﾀｲﾌﾟｼﾌﾄﾉﾌﾞ(AT車）': 'sports-type shift knob (automatic)',
  'ｽﾎﾟｰﾂﾀｲﾌﾟｼﾌﾄﾉﾌﾞ(AT車)GTS25ﾀｲﾌﾟXG': 'sports-type shift knob (automatic), GTS25 type X G',
  '本木目ｺﾝｿｰﾙ': 'genuine wood console',
  'ﾄﾗﾝｸﾘｯﾄﾞﾄﾘﾑ': 'trunk lid trim',

  // exterior body
  'ﾘﾔｽﾎﾟｲﾗｰ': 'rear spoiler',
  'ﾘﾔｽﾎﾟｲﾗ-': 'rear spoiler',
  'ﾘﾔｽﾎﾟｲﾗｰ(標準ﾀｲﾌﾟ)': 'rear spoiler (standard type)',
  '大型ﾘﾔｽﾎﾟｲﾗｰ': 'large rear spoiler',
  'ﾊｲﾏｳﾝﾄｽﾄｯﾌﾟﾗﾝﾌﾟ付ﾘﾔｽﾎﾟｲﾗｰ': 'rear spoiler with high-mount stop lamp',
  'ﾊｲﾏｳﾝﾄ付ﾘﾔｽﾎﾟ': 'rear spoiler with high-mount stop lamp',
  'ｶｰﾎﾞﾝｾﾝﾀｰﾘﾔｽﾎﾟｲﾗｰ': 'carbon centre rear spoiler',
  'ｶｰﾎﾞﾝ水平翼付ﾘﾔｽﾎﾟｲﾗｰ': 'rear spoiler with carbon horizontal blade',
  'ﾘﾔｰｽﾎﾟｲﾗｰ4ﾄﾞｱ用': 'rear spoiler, 4-door',
  'ﾘﾔｰｽﾎﾟｲﾗｰ2ﾄﾞｱ用': 'rear spoiler, 2-door',
  'ﾘﾔｽﾎﾟｲﾗｰ2ﾄﾞｱ用': 'rear spoiler, 2-door',
  'GTｵｰﾄｽﾎﾟｲﾗｰ': 'GT auto spoiler',
  'GTｵｰﾄｽﾎﾟｲﾗｰ&ﾘﾔｽﾎﾟｲﾗｰ': 'GT auto spoiler and rear spoiler',
  'ｴｱｽﾎﾟｲﾗｰ': 'air spoiler',
  'ｴｱｽﾎﾟｲﾗｰ無し': 'air spoiler delete',
  '大型ﾌﾛﾝﾄｽﾎﾟｲﾗｰ': 'large front spoiler',
  '大型ﾌﾛﾝﾄｽﾎﾟｲﾗｰ(Vｽﾍﾟｯｸ用)': 'large front spoiler (V-Spec)',
  'ｴｱﾛﾌｫﾙﾑﾊﾞﾝﾊﾟｰ': 'aero-form bumper',
  'ﾌﾛﾝﾄｴｱﾛﾊﾞﾝﾊﾟｰ': 'front aero bumper',
  'ｴｱｲﾝﾃｰｸ付ﾌﾛﾝﾄﾊﾞﾝﾊﾟｰ': 'front bumper with air intake',
  '大型ﾘﾔｽﾎﾟｲﾗｰｴｱﾛﾌｫﾙﾑﾊﾞﾝﾊﾟｰ(ｴｱﾛﾊﾟｯｹｰｼﾞ)':
    'large rear spoiler and aero-form bumper (Aero Package)',
  'ｽﾎﾟｰﾂｸﾞﾘﾙ': 'sports grille',
  'ｻｲﾄﾞｼﾙﾌﾟﾛﾃｸﾀｰ': 'side sill protectors',
  'ﾒｯｷﾄﾞｱﾊﾝﾄﾞﾙﾚｽ(樹脂色)': 'chrome door handles deleted (body-colour resin)',
  'ﾒｯｷﾄﾞｱﾊﾝﾄﾞﾚｽ(樹脂色)': 'chrome door handles deleted (body-colour resin)',
  'ﾒｯｷｲﾝｻｲﾄﾞﾄﾞｱﾊﾝﾄﾞﾙﾚｽ': 'chrome inside door handles deleted',
  'ﾌｰﾄﾞﾄｯﾌﾟﾓｰﾙ': 'hood top moulding',
  'ｴｷｿﾞｰｽﾄﾌｨﾆｯｼｬｰ': 'exhaust finisher',
  'ﾃﾞｭｱﾙﾓｰﾄﾞﾏﾌﾗｰ': 'dual-mode exhaust',
  'ｵｰﾅﾒﾝﾄ付き': 'with ornament',
  'SEｴﾝﾌﾞﾚﾑ': 'SE emblem',
  'SE ｴﾝﾌﾞﾚﾑ': 'SE emblem',
  "Sﾊﾞｯﾁ&K'sﾊﾞｯﾁ": "S badge and K's badge",

  // chassis and performance
  'FRｽﾄﾗｯﾄﾀﾜｰﾊﾞｰ': 'front strut tower bar',
  'FRｽﾄﾗｯﾄﾀﾜｰﾊﾞｰ (25GTVｼﾖｳ)': 'front strut tower bar (25GT-V specification)',
  'ﾘﾔｽﾄﾗｯﾄﾀﾜｰﾊﾞｰ': 'rear strut tower bar',
  'ｱﾄﾞﾊﾞﾝｽﾄﾞｴｱﾛｼｽﾃﾑ': 'advanced aero system',
  'ｱﾄﾞﾊﾞﾝｽﾄﾞｴｱﾛｼｽﾃﾑ (VｽﾍﾟｯｸIIｼﾖｳ)': 'advanced aero system (V-Spec II specification)',
  'ﾘｯﾌﾟﾙｺﾝﾄﾛｰﾙｼｮｯｸｱﾌﾞｿｰﾊﾞｰ': 'Ripple Control shock absorbers',

  // grade and edition markers that appear inside description lines
  'N1仕様': 'N1 specification',
  'GTRN1仕様': 'GT-R N1 specification',
  'GTR/N1ｼﾖｳ': 'GT-R N1 specification',
  'Mｽﾍﾟｯｸ ｼﾖｳ': 'M-Spec specification',
  'Mｽﾍﾟｯｸ　Nurｼﾖｳ': 'M-Spec Nür specification',
  'VｽﾍﾟｯｸII Nurｼﾖｳ': 'V-Spec II Nür specification',
  'ﾘﾐﾃｯﾄﾞ仕様': 'Limited specification',
  'LMﾘﾐﾃｯﾄﾞ仕様': 'LM Limited specification',
  'TYPE-B 仕様': 'Type B specification',
  'ﾌﾟﾗｲﾑｴﾃﾞｨｼｮﾝ(NA系)': 'Prime Edition (naturally aspirated models)',
  'ﾎﾜｲﾄｴｱﾛｾﾚｸｼｮﾝ仕様': 'White Aero Selection specification',
  '40THｱﾆﾊﾞｰｻﾘｰ': '40th Anniversary',
  'ﾀｲﾌﾟM 40THｱﾆﾊﾞｰｻﾘｰ': 'type M 40th Anniversary',
  'ﾀﾞｲﾔｾﾚｸｼｮﾝ2仕様': 'Diamond Selection II specification',
  "Q'sSEﾀﾞｲﾔｾﾚｸｼｮﾝ": "Q's SE Diamond Selection",
  "Q's SEﾀﾞｲﾔｾﾚｸｼｮﾝII": "Q's SE Diamond Selection II",
  "Q's､Q'sSE": "Q's and Q's SE",
  "Q'sｴｱﾛ､Q'Sｴｱﾛ SE": "Q's Aero and Q's Aero SE",
  "J's": "J's",
  "K's": "K's",
  'GTSﾀｲﾌﾟG': 'GTS type G',
  'GTS-4': 'GTS-4',
  'GTS-4(2ﾄﾞｱ)': 'GTS-4 (2-door)',
  'GTSｰ4仕様(4ﾄﾞｱ)': 'GTS-4 specification (4-door)',
  'GTS-4ﾀｲﾌﾟX(4ﾄﾞｱ)': 'GTS-4 type X (4-door)',
  'GTSﾀｲﾌﾟX(4ﾄﾞｱ)': 'GTS type X (4-door)',
  'GTSﾀｲﾌﾟS(4ﾄﾞｱ)': 'GTS type S (4-door)',
  'GTSﾀｲﾌﾟS(2ﾄﾞｱ)': 'GTS type S (2-door)',
  'GTS25ﾀｲﾌﾟX(4ﾄﾞｱ)': 'GTS25 type X (4-door)',
  'GTS25ﾀｲﾌﾟS/S(4ﾄﾞｱ)': 'GTS25 type S/S (4-door)',
  'GTS25ﾀｲﾌﾟS(2ﾄﾞｱ)': 'GTS25 type S (2-door)',
  'GTS25TﾀｲﾌﾟM': 'GTS25T type M',
  'GTS25TﾀｲﾌﾟM(ﾘﾔﾜｲﾊﾟｰ付き)': 'GTS25T type M (with rear wiper)',
  'GTS25TﾀｲﾌﾟM1(4ﾄﾞｱ)': 'GTS25T type M1 (4-door)',
  'GTS25TﾀｲﾌﾟM2(4ﾄﾞｱ)': 'GTS25T type M2 (4-door)',
  'GTS25TﾀｲﾌﾟM2(2ﾄﾞｱ)': 'GTS25T type M2 (2-door)',
  'ｱｰﾊﾞﾝﾗﾝﾅｰS': 'Urban Runner S'
};

// ---------------------------------------------------------------------------
function parseFastop() {
  const dec = new TextDecoder('shift_jis');
  const buf = fs.readFileSync(SRC);
  const lat = buf.toString('latin1');
  const recs = [];

  for (let i = 0; i + REC <= buf.length; i++) {
    const code = lat.slice(i, i + 6);
    if (!/^[A-Z][A-Z0-9]{1,5} *$/.test(code)) continue;
    const chassis = code.trim();
    if (!GENS.includes(chassis)) continue;

    // Window: four digits, then four more OR four blanks for an open window.
    const win = lat.slice(i + 6, i + 14);
    if (!/^[0-9]{4}([0-9]{4}| {4})$/.test(win)) continue;

    const mask = lat.slice(i + 14, i + 20);
    const slots = mask.slice(0, 5);
    if (slots.replace(/\*/g, '').length !== 1) continue;
    const tag = mask[5];
    if (!/^[0-9]$/.test(tag)) continue;      // description lines only

    const pos = [...slots].findIndex(c => c !== '*');
    const raw = buf.subarray(i + 20, i + 55);   // 35 bytes, NOT 39
    let end = raw.length;
    while (end > 0 && raw[end - 1] === 0x20) end--;

    recs.push({
      off: i - 4, chassis,
      from: +win.slice(0, 4),
      to: win.slice(4).trim() === '' ? null : +win.slice(4),
      pos, char: slots[pos], tag,
      text: dec.decode(raw.subarray(0, end))
    });
  }

  // Join continuation lines in tag order.
  const merged = new Map();
  for (const r of recs.sort((a, b) => a.off - b.off)) {
    const k = [r.chassis, r.from, r.to, r.pos, r.char].join('|');
    if (!merged.has(k)) merged.set(k, { ...r, parts: [[r.tag, r.text]] });
    else merged.get(k).parts.push([r.tag, r.text]);
  }
  for (const r of merged.values()) {
    r.jp = r.parts.sort((a, b) => a[0].localeCompare(b[0])).map(p => p[1]).join('');
    delete r.parts; delete r.tag; delete r.text;
  }
  return [...merged.values()];
}

function translate(jp, unknown) {
  let s = jp;
  const held = [];
  for (const [phrase, eng] of PHRASES) {
    while (s.includes(phrase)) {
      s = s.replace(phrase, '\u0000' + held.length + '\u0000');
      held.push(eng);
    }
  }
  const out = [];
  for (const part of s.split('+')) {
    const t = part.trim();
    if (!t) continue;
    const m = /^\u0000(\d+)\u0000$/.exec(t);
    if (m) { out.push(held[+m[1]]); continue; }
    if (Object.prototype.hasOwnProperty.call(TERMS, t)) { out.push(TERMS[t]); continue; }
    unknown.set(t, (unknown.get(t) || 0) + 1);
    out.push(null);
  }
  return out.includes(null) ? null : out.join(' + ');
}

function main() {
  const write = process.argv.includes('--write');
  const all = parseFastop();

  // What already shipped, keyed the same way, so existing English is reused
  // rather than regenerated.
  const prev = JSON.parse(fs.readFileSync(OUT, 'utf8').replace(/^\uFEFF/, ''));
  const prevBy = new Map();
  let prevTotal = 0;
  for (const gen of Object.keys(prev))
    for (const e of prev[gen]) {
      prevBy.set([gen, e.from, e.to, e.pos, e.char].join('|'), e);
      prevTotal++;
    }

  const unknown = new Map();
  const out = {};
  let kept = 0, added = 0, failed = 0;

  for (const r of all) {
    // An open window is stored with a far-future end. database.js already
    // maps a value below 8000 into the 2000s (`e.to < 8000 ? e.to + 10000`),
    // so 19912 reads as 2099-12 and never triggers that remap.
    const to = r.to === null ? 19912 : r.to;
    const key = [r.chassis, r.from, r.to === null ? 19912 : r.to, r.pos, r.char].join('|');
    const legacy = prevBy.get(key) || prevBy.get([r.chassis, r.from, r.to, r.pos, r.char].join('|'));

    let text;
    if (legacy) { text = legacy.text; kept++; }
    else {
      text = translate(r.jp, unknown);
      if (text === null) { failed++; continue; }
      added++;
    }
    (out[r.chassis] = out[r.chassis] || []).push({
      from: r.from, to, pos: r.pos, char: r.char, text
    });
  }

  for (const gen of Object.keys(out))
    out[gen].sort((a, b) => a.from - b.from || a.pos - b.pos || a.char.localeCompare(b.char));

  console.log('FASTOP options parsed: ' + all.length);
  console.log('  carried over from the shipped file (unchanged): ' + kept);
  console.log('  newly translated:                               ' + added);
  console.log('  untranslatable (skipped):                       ' + failed);
  console.log('');
  for (const gen of GENS) {
    const list = out[gen] || [];
    const wins = [...new Set(list.map(e => e.from + '-' + (e.to === 19912 ? '(open)' : e.to)))];
    console.log('  ' + gen.padEnd(5) + String(list.length).padStart(4) + ' options   ' + wins.join(' '));
  }

  if (unknown.size) {
    console.log('\nUNTRANSLATED TERMS (' + unknown.size + ') — add to TERMS and re-run:');
    for (const [t, c] of [...unknown.entries()].sort((a, b) => b[1] - a[1]))
      console.log('  ' + String(c).padStart(3) + '  ' + t);
  }

  // Refuse to write anything smaller than what is already live, or anything
  // that lost a definition the shipped file had. This script exists BECAUSE a
  // generator wrote a short file without complaining.
  const total = Object.values(out).reduce((s, l) => s + l.length, 0);
  if (unknown.size) {
    console.log('\nNOT WRITING: ' + unknown.size + ' terms have no translation.');
    process.exit(1);
  }
  if (total < prevTotal) {
    console.log('\nNOT WRITING: ' + total + ' options is fewer than the ' + prevTotal +
                ' already shipped — that is a regression, not an update.');
    process.exit(1);
  }
  if (kept < prevTotal) {
    console.log('\nNOT WRITING: only ' + kept + ' of ' + prevTotal +
                ' shipped options were matched in the source; the key scheme has drifted.');
    process.exit(1);
  }

  if (!write) { console.log('\n(dry run — pass --write to update ' + OUT + ')'); return; }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('\nwrote ' + OUT + '  (' + total + ' options, was ' + prevTotal + ')');
}

main();
