/**
 * BPZILLA — NISSAN SKYLINE FACTORY RECORD DATABASE
 *
 * Every record is extracted directly from the Nissan FAST microfiche binaries
 * at H:\AR-JP\JP — the VINDAT4/5/6 chassis tables joined against MDLCODE for
 * the 20-character factory model code. Verified byte-for-byte against that
 * source on 2026-08-18 (see the R31/R30 note below for what changed since).
 *
 * 543,299 factory records across 14 FAST chassis files, 1987–2002:
 *   HCR32  144,097   HR32    73,321   HR33    63,726   ECR33   64,256
 *   BNR32   43,895   ER34    37,266   ER33    28,380   HNR32   17,667
 *   FR32    16,881   BCNR33  16,560   HR34    14,917   BNR34   11,474
 *   ENR33    7,476   ENR34    3,383
 *
 * R31 (HR31, 182,351 records — the single largest chassis) and R30 (DR30,
 * 44,439 records) are intentionally out of scope and not loaded. Both counts
 * were verified against the real FAST source and were not a bug, they were
 * just judged out of scope for this site and dropped by request.
 *
 * Two chassis share a single FAST code across more than one real trim, so
 * they're presented here as more than one browsable model even though they
 * come from one physical data file — see `chassisPrefix` / `gradeFilter`
 * below. ER34 covers both the NA 25GT and the turbo 25GT-t; ECR33 covers a
 * dominant grade plus a rare ~1.8% variant whose exact trim name isn't
 * confirmed (see the ECR33_V entry).
 *
 * Storage note: at this scale a record-per-object model costs hundreds of
 * megabytes in the browser, so each model is held as parallel typed arrays
 * with its dates, paint codes, trim codes and model codes interned once per
 * file. Record objects are materialised only for the rows actually displayed.
 */

const JDM_DATABASE = {

  // ---- Columnar store, one entry per model ----
  // { BCNR33: { n, blk, ser, di, ci, ti, mci, dict:{b,d,c,t,mc}, ranges } }
  _cols: {},
  _byPrefix: {},         // legacy shim: { BCNR33: { length: n } }
  _paint: {},            // paint code -> factory colour name
  _totalRecords: 0,
  _loaded: false,
  loadError: null,

  // ---- Chassis covered by the FAST record set ----
  models: {

    // =========================================================
    // R34 GENERATION (1998 – 2002)
    // =========================================================
    'BNR34': {
      id: 'BNR34', chassisPrefix: 'BNR34',
      generation: 'R34 (10th Gen)',
      name: 'Nissan Skyline GT-R (BNR34)',
      shortName: 'R34 GT-R',
      chassisCode: 'GF-BNR34',
      bodyStyle: '2-Door Coupe',
      years: '1999 – 2002',
      engine: 'RB26DETT 2.6L Twin-Turbo I6 (280 PS / 276 hp)',
      transmission: 'Getrag 6-Speed Manual (FS6R30A)',
      drivetrain: 'ATTESA E-TS Pro AWD + Super HICAS 4WS',
      badgeClass: 'badge-gtr',
      description: 'Pinnacle GT-R with Getrag 6-speed, carbon diffuser, MFD.'
    },
    // ER34 is one physical FAST chassis code shared by two real trims — the
    // naturally aspirated 25GT and the turbocharged 25GT-t — distinguished
    // only by the factory grade code (position 5: E = 25GT, T = GT-t; checked
    // against all 37,266 ER34 records, no other character appears there).
    // They're split into two browsable models here so "GT" isn't hidden
    // inside a combined GT/GT-t entry. `chassisPrefix` points both at the one
    // physical data file (fast_er34.json); `gradeFilter` is the character
    // that selects which rows belong to each.
    'ER34_GT': {
      id: 'ER34_GT', chassisPrefix: 'ER34', gradeFilter: 'E',
      generation: 'R34 (10th Gen)',
      name: 'Skyline 25GT (ER34)',
      shortName: 'R34 25GT',
      chassisCode: 'GF-ER34',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1998 – 2002',
      engine: 'RB25DE NEO 2.5L NA 24-Valve (200 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Tiptronic',
      drivetrain: 'RWD + Helical LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The naturally aspirated half of the ER34 chassis code — same body, same chassis, RB25DE instead of the turbo RB25DET.'
    },
    'ER34_GTT': {
      id: 'ER34_GTT', chassisPrefix: 'ER34', gradeFilter: 'T',
      generation: 'R34 (10th Gen)',
      name: 'Skyline 25GT-t / GT-T (ER34)',
      shortName: 'R34 GT-T',
      chassisCode: 'GF-ER34',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1998 – 2002',
      engine: 'RB25DET NEO 2.5L Turbo 24-Valve (280 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Tiptronic',
      drivetrain: 'RWD + Helical LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The turbocharged half of the ER34 chassis code — the iconic R34 GT-T, RB25DET NEO.'
    },
    'ENR34': {
      id: 'ENR34', chassisPrefix: 'ENR34',
      generation: 'R34 (10th Gen)',
      name: 'Skyline 25GT-Four AWD (ENR34)',
      shortName: 'R34 25GT-Four',
      chassisCode: 'GF-ENR34',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1998 – 2002',
      engine: 'RB25DE NEO 2.5L NA 24-Valve (200 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'ATTESA E-TS AWD (Full GT-R drivetrain, NA engine)',
      badgeClass: 'badge-nissan',
      description: 'Factory 4WD Skyline with GT-R AWD system and naturally aspirated engine.'
    },
    'HR34': {
      id: 'HR34', chassisPrefix: 'HR34',
      generation: 'R34 (10th Gen)',
      name: 'Skyline 20GT (HR34)',
      shortName: 'R34 20GT',
      chassisCode: 'GF-HR34',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1998 – 2002',
      engine: 'RB20DE NEO 2.0L NA 24-Valve (155 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Entry-level R34 powered by the refined RB20DE NEO straight-six.'
    },

    // =========================================================
    // R33 GENERATION (1993 – 1998)
    // =========================================================
    'BCNR33': {
      id: 'BCNR33', chassisPrefix: 'BCNR33',
      generation: 'R33 (9th Gen)',
      name: 'Nissan Skyline GT-R (BCNR33)',
      shortName: 'R33 GT-R',
      chassisCode: 'E-BCNR33',
      bodyStyle: '2-Door Coupe',
      years: '1995 – 1998',
      engine: 'RB26DETT 2.6L Twin-Turbo I6 (280 PS / 276 hp)',
      transmission: '5-Speed Manual (FS5R30A)',
      drivetrain: 'ATTESA E-TS / E-TS Pro AWD + Super HICAS',
      badgeClass: 'badge-gtr',
      description: 'Nürburgring sub-8-minute master (7:59.887) — the most complete Skyline GT-R record set in the archive.'
    },
    // ECR33's factory code carries a grade character (position 5) with two
    // values across all 64,256 records: T on 63,099 of them (98.2%) and V on
    // the remaining 1,157 (1.8%). Both run the full 1993–1998 span and the
    // same color mix, so it isn't a running change or a color-exclusive
    // special edition — it reads as a genuinely distinct, continuously
    // produced grade. What "V" specifically denotes isn't confirmed (grade
    // letters aren't consistent in meaning across chassis — BNR34 uses V for
    // its *base* grade, not a special one), so it's split out here rather
    // than folded into the main GTS25-t entry or given an invented name.
    'ECR33': {
      id: 'ECR33', chassisPrefix: 'ECR33', gradeFilter: 'T',
      generation: 'R33 (9th Gen)',
      name: 'Skyline GTS25-t / GTST (ECR33)',
      shortName: 'R33 GTS25-t',
      chassisCode: 'E-ECR33',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1993 – 1998',
      engine: 'RB25DET 2.5L Turbo DOHC 24-Valve (250 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Auto',
      drivetrain: 'RWD + Viscous LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The beloved GTST R33 with RB25DET and 4-pot Brembo brakes. Grade code T — 98.2% of the ECR33 chassis; see GTS25-t (Type V) for the rest.'
    },
    'ECR33_V': {
      id: 'ECR33_V', chassisPrefix: 'ECR33', gradeFilter: 'V',
      generation: 'R33 (9th Gen)',
      name: 'Skyline GTS25-t (ECR33, Type V)',
      shortName: 'R33 GTS25-t (V)',
      chassisCode: 'E-ECR33',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1993 – 1998',
      engine: 'RB25DET 2.5L Turbo DOHC 24-Valve (250 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Auto',
      drivetrain: 'RWD + Viscous LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The same ECR33 GTST chassis carrying grade code V instead of T — 1.8% of the chassis, present throughout the full production run. What specifically distinguishes this grade isn’t confirmed in the archive.'
    },
    'ER33': {
      id: 'ER33', chassisPrefix: 'ER33',
      generation: 'R33 (9th Gen)',
      name: 'Skyline GTS25 (ER33)',
      shortName: 'R33 GTS25',
      chassisCode: 'E-ER33',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1993 – 1998',
      engine: 'RB25DE 2.5L DOHC 24-Valve NA (190 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Naturally aspirated 2.5L R33 Skyline.'
    },
    'ENR33': {
      id: 'ENR33', chassisPrefix: 'ENR33',
      generation: 'R33 (9th Gen)',
      name: 'Skyline GTS-4 AWD (ENR33)',
      shortName: 'R33 GTS-4',
      chassisCode: 'E-ENR33',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1993 – 1998',
      engine: 'RB25DE 2.5L DOHC NA (190 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'ATTESA E-TS AWD',
      badgeClass: 'badge-nissan',
      description: 'Factory AWD non-turbo Skyline R33.'
    },
    'HR33': {
      id: 'HR33', chassisPrefix: 'HR33',
      generation: 'R33 (9th Gen)',
      name: 'Skyline GTS / GTE (HR33)',
      shortName: 'R33 GTS',
      chassisCode: 'E-HR33',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1993 – 1998',
      engine: 'RB20DE 2.0L NA / RB20E SOHC (130–155 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Base 2.0L R33 Skyline models.'
    },

    // =========================================================
    // R32 GENERATION (1989 – 1994)
    // =========================================================
    'BNR32': {
      id: 'BNR32', chassisPrefix: 'BNR32',
      generation: 'R32 (8th Gen)',
      name: 'Nissan Skyline GT-R "Godzilla" (BNR32)',
      shortName: 'R32 GT-R',
      chassisCode: 'E-BNR32',
      bodyStyle: '2-Door Coupe',
      years: '1989 – 1994',
      engine: 'RB26DETT 2.6L Twin-Turbo I6 (280 PS)',
      transmission: '5-Speed Manual (FS5R30A)',
      drivetrain: 'ATTESA E-TS AWD + Super HICAS',
      badgeClass: 'badge-gtr',
      description: '"Godzilla" — the undefeated legend.'
    },
    'HCR32': {
      id: 'HCR32', chassisPrefix: 'HCR32',
      generation: 'R32 (8th Gen)',
      name: 'Skyline GTS-t Type M (HCR32)',
      shortName: 'R32 GTS-t',
      chassisCode: 'E-HCR32',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1989 – 1994',
      engine: 'RB20DET 2.0L Turbo DOHC 24-Valve (215 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Auto',
      drivetrain: 'RWD + Viscous LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The turbocharged R32 GTS-t with RB20DET.'
    },
    'HNR32': {
      id: 'HNR32', chassisPrefix: 'HNR32',
      generation: 'R32 (8th Gen)',
      name: 'Skyline GTS-4 AWD (HNR32)',
      shortName: 'R32 GTS-4',
      chassisCode: 'E-HNR32',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1989 – 1994',
      engine: 'RB20DET 2.0L Turbo (215 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'ATTESA E-TS AWD',
      badgeClass: 'badge-nissan',
      description: 'Factory AWD turbocharged R32.'
    },
    'HR32': {
      id: 'HR32', chassisPrefix: 'HR32',
      generation: 'R32 (8th Gen)',
      name: 'Skyline GTS (HR32)',
      shortName: 'R32 GTS',
      chassisCode: 'E-HR32',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1989 – 1994',
      engine: 'RB20DE 2.0L NA DOHC (155 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Naturally aspirated R32 GTS.'
    },
    'FR32': {
      id: 'FR32', chassisPrefix: 'FR32',
      generation: 'R32 (8th Gen)',
      name: 'Skyline GTE (FR32)',
      shortName: 'R32 GTE',
      chassisCode: 'E-FR32',
      bodyStyle: '4-Door Sedan',
      years: '1989 – 1994',
      engine: 'RB20E 2.0L SOHC (125 PS)',
      transmission: '4-Speed Auto / 5-Speed Manual',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Base SOHC R32 Skyline sedan.'
    },

    // R31 (HR31) is intentionally not included — see the file header note.

    // R30 (DR30) is intentionally not included — see the file header note.

    // =========================================================
    // NISSAN LEGENDS — S13 GENERATION (1988 – 1993)
    // =========================================================
    // Not a Skyline. Read from the same FAST source (H:\AR-JP\JP), same
    // methodology, same byte-for-byte cross-validation against a known
    // chassis before trusting anything — see the extraction note in
    // js/modelDecoder.js-adjacent tooling for how this was pulled. Four real
    // factory chassis prefixes came out of the binary cleanly: S13, PS13,
    // KS13 and RS13, each its own physical FAST file (fast_s13.json,
    // fast_ps13.json, fast_ks13.json, fast_rs13.json) — so, like the Skyline
    // R32 generation, they're four separate browsable models rather than one
    // combined "S13" entry.
    'S13': {
      id: 'S13', chassisPrefix: 'S13',
      generation: 'S13 (Silvia)',
      name: 'Nissan Silvia (S13)',
      shortName: 'S13',
      chassisCode: 'E-S13',
      bodyStyle: '2-Door Coupe',
      years: '1988 – 1993',
      engine: 'CA18DE 1.8L NA DOHC / SR20DE 2.0L NA DOHC (model-year dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Naturally aspirated S13 Silvia coupe — CA18DE early cars, SR20DE after the 1991 running change.'
    },
    // 12,197 records inside this physical file literally spell "KS13..."
    // rather than "S13...", the same shape as our separate KS13 (which is
    // itself confirmed to be a real distinct Super HICAS chassis, not this
    // one) — a different chassis-prefix text mixed into one file, the same
    // situation the WGNC34/260RS split was. Split out below as KPS13.
    'PS13': {
      id: 'PS13', chassisPrefix: 'PS13',
      gradeFilter: '0:!K',
      generation: 'S13 (Silvia)',
      name: 'Nissan Silvia Turbo (PS13)',
      shortName: 'S13 Turbo',
      chassisCode: 'E-PS13',
      bodyStyle: '2-Door Coupe',
      years: '1988 – 1993',
      engine: 'CA18DET 1.8L Turbo / SR20DET 2.0L Turbo (model-year dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Turbocharged S13 Silvia coupe — CA18DET early cars, SR20DET after the 1991 running change.'
    },
    'KPS13': {
      id: 'KPS13', chassisPrefix: 'PS13',
      gradeFilter: '0:K',
      generation: 'S13 (Silvia)',
      name: 'Nissan Silvia Turbo, Super HICAS (KPS13)',
      shortName: 'S13 Turbo HICAS',
      chassisCode: 'E-KPS13',
      bodyStyle: '2-Door Coupe',
      years: '1988 – 1993',
      engine: 'CA18DET 1.8L Turbo / SR20DET 2.0L Turbo (model-year dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The Super HICAS (rear-wheel steering) counterpart to PS13 — same relationship KS13 has to plain S13, one physical file apart. 12,197 records, split out rather than left folded into PS13\'s count.'
    },
    // What KS13 specifically denotes isn't confirmed with the same certainty
    // as S13/PS13/RS13. The best-corroborated public reading is a Super
    // HICAS (rear-wheel steering) equipped S13, but which engine it pairs
    // with isn't nailed down here — stated plainly rather than guessed.
    'KS13': {
      id: 'KS13', chassisPrefix: 'KS13',
      generation: 'S13 (Silvia)',
      name: 'Nissan Silvia (KS13)',
      shortName: 'S13 (KS13)',
      chassisCode: 'E-KS13',
      bodyStyle: '2-Door Coupe',
      years: '1988 – 1993',
      engine: 'CA18DET / SR20DET (unconfirmed which is paired with this code)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'A separate real FAST chassis code from plain S13 — believed to denote Super HICAS (4WS) equipment, though that isn\u2019t independently confirmed here.'
    },
    // RS13 is the hatchback body — sold as the 180SX in Japan and as the
    // 200SX in Europe — not the Silvia coupe. Same S13 platform, different
    // model name and different sheet metal aft of the A-pillar.
    'RS13': {
      id: 'RS13', chassisPrefix: 'RS13',
      generation: 'S13 (Silvia)',
      name: 'Nissan 180SX (RS13)',
      shortName: '180SX',
      chassisCode: 'E-RS13',
      bodyStyle: '3-Door Hatchback',
      years: '1988 – 1993',
      engine: 'CA18DET 1.8L Turbo / SR20DET 2.0L Turbo (model-year dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The fixed-headlight hatchback on the S13 platform — sold as the 180SX in Japan, 200SX in Europe.'
    },

    // =========================================================
    // NISSAN LEGENDS — S14 GENERATION (1993 – 1998)
    // =========================================================
    'S14': {
      id: 'S14', chassisPrefix: 'S14',
      generation: 'S14 (Silvia)',
      name: 'Nissan Silvia (S14)',
      shortName: 'S14',
      chassisCode: 'E-S14',
      bodyStyle: '2-Door Coupe',
      years: '1993 – 1998',
      engine: 'SR20DE 2.0L NA DOHC / SR20DET 2.0L Turbo (grade dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'S14 Silvia coupe, covering both naturally aspirated and turbo grades under one FAST chassis code.'
    },
    // Same caveat as KS13: real, separate FAST code, best-corroborated
    // public reading is Super HICAS equipment, exact engine pairing not
    // independently confirmed here.
    'CS14': {
      id: 'CS14', chassisPrefix: 'CS14',
      generation: 'S14 (Silvia)',
      name: 'Nissan Silvia (CS14)',
      shortName: 'S14 (CS14)',
      chassisCode: 'E-CS14',
      bodyStyle: '2-Door Coupe',
      years: '1993 – 1998',
      engine: 'SR20DE / SR20DET (unconfirmed which is paired with this code)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'A separate real FAST chassis code from plain S14 — believed to denote Super HICAS (4WS) equipment, though that isn\u2019t independently confirmed here.'
    },

    // =========================================================
    // NISSAN LEGENDS — C34 GENERATION STAGEA (1996 – 2001)
    // =========================================================
    // Same source, same methodology as Silvia above. Three real chassis
    // codes came out of the binary cleanly — WGC34, WHC34, WGNC34 — each its
    // own physical file. Three further gen-1 codes that are documented
    // elsewhere (WPC34, HWC34, WHNC34) were searched for and genuinely are
    // not in this FAST snapshot, the same way S15 wasn't — left out rather
    // than guessed at.
    'WGC34': {
      id: 'WGC34', chassisPrefix: 'WGC34',
      generation: 'C34 (Stagea)',
      name: 'Nissan Stagea 25t / 25 (WGC34)',
      shortName: 'Stagea 25 (2WD)',
      chassisCode: 'E-WGC34',
      bodyStyle: '5-Door Wagon',
      years: '1996 – 2001',
      engine: 'RB25DE 2.5L NA / RB25DET 2.5L Turbo (grade dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'Rear-wheel-drive Stagea wagon on the RB25 straight-six, in both naturally aspirated and turbo grades.'
    },
    'WHC34': {
      id: 'WHC34', chassisPrefix: 'WHC34',
      generation: 'C34 (Stagea)',
      name: 'Nissan Stagea 20 (WHC34)',
      shortName: 'Stagea 20',
      chassisCode: 'E-WHC34',
      bodyStyle: '5-Door Wagon',
      years: '1996 – 2001',
      engine: 'RB20DE 2.0L NA DOHC',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The entry-level RB20-powered Stagea wagon.'
    },
    // WGNC34 also underpins the Autech 260RS — 1,734 cars Autech built with
    // a complete R33 GT-R RB26DETT/ATTESA E-TS Pro drivetrain swap in
    // 1997-1998. An earlier pass here concluded the FAST data had no marker
    // distinguishing them and folded them into plain WGNC34. That was wrong
    // — a full per-position scan found one: position 12 is 'P' for exactly
    // 1,734 records, all sharing one identical model code
    // (GKNRFAC34UDAP88AZAWC), dated 1997-07 to 2001-03. The count matching
    // the documented production figure exactly, on an otherwise-untouched
    // position, is about as strong a match as this kind of check gets — see
    // WGNC34_260RS below.
    'WGNC34': {
      id: 'WGNC34', chassisPrefix: 'WGNC34',
      gradeFilter: '12:!P',
      generation: 'C34 (Stagea)',
      name: 'Nissan Stagea 25t RS Four (WGNC34)',
      shortName: 'Stagea 25 (4WD)',
      chassisCode: 'E-WGNC34',
      bodyStyle: '5-Door Wagon',
      years: '1996 – 2001',
      engine: 'RB25DE 2.5L NA / RB25DET 2.5L Turbo (grade dependent)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'ATTESA E-TS AWD',
      badgeClass: 'badge-nissan',
      description: 'The ATTESA E-TS four-wheel-drive Stagea wagon. The 260RS built on this same chassis is now broken out separately — see below.'
    },
    'WGNC34_260RS': {
      id: 'WGNC34_260RS', chassisPrefix: 'WGNC34',
      gradeFilter: '12:P',
      generation: 'C34 (Stagea)',
      name: 'Nissan Stagea 260RS (Autech, WGNC34-based)',
      shortName: 'Stagea 260RS',
      chassisCode: 'E-WGNC34 (Autech-converted)',
      bodyStyle: '5-Door Wagon',
      years: '1997 – 1998 (built) / records dated through 2001-03',
      engine: 'RB26DETT 2.6L Twin-Turbo I6 (R33 GT-R swap, Autech-installed)',
      // Per-record decode shows a real, roughly 57/43 automatic/manual
      // split — not manual-only as the R33 GT-R drivetrain donor might
      // suggest, so Autech evidently kept the Stagea's own transmission
      // options rather than swapping that too.
      transmission: '5-Speed Manual / 4-Speed Automatic',
      drivetrain: 'ATTESA E-TS Pro AWD (R33 GT-R swap)',
      badgeClass: 'badge-gtr',
      description: 'Autech\'s complete R33 GT-R RB26DETT/ATTESA E-TS Pro drivetrain swap into a standard WGNC34 Stagea body — 1,734 built, all recorded here under one identical factory model code. The GT-R-grade drivetrain is why this carries the GT-R badge style rather than the standard Stagea one.'
    },

    // =========================================================
    // NISSAN LEGENDS — M35 GENERATION STAGEA (2001 – 2007)
    // =========================================================
    // Four real chassis codes, all cleanly single-source in the binary (no
    // cross-file marker mixing the way Silvia's PS13/RS13 needed sorting
    // out). Drivetrain is stated with slightly less certainty than the
    // engine displacement — see each description.
    'NM35': {
      id: 'NM35', chassisPrefix: 'NM35',
      generation: 'M35 (Stagea)',
      name: 'Nissan Stagea 25RS Four (NM35)',
      shortName: 'Stagea 25 (M35)',
      chassisCode: 'GH-NM35',
      bodyStyle: '5-Door Wagon',
      years: '2001 – 2007',
      engine: 'VQ25DD 2.5L NA V6 / VQ25DET 2.5L Turbo V6 (grade dependent)',
      transmission: '5-Speed Auto',
      drivetrain: 'ATTESA E-TS AWD',
      badgeClass: 'badge-nissan',
      description: 'The 2.5L second-generation Stagea, carried through the entire M35 production run.'
    },
    'HM35': {
      id: 'HM35', chassisPrefix: 'HM35',
      generation: 'M35 (Stagea)',
      name: 'Nissan Stagea 300RX (HM35)',
      shortName: 'Stagea 300RX',
      chassisCode: 'GH-HM35',
      bodyStyle: '5-Door Wagon',
      years: '2001 – 2004',
      engine: 'VQ30DD 3.0L NA V6',
      transmission: '5-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The 3.0L grade that opened the M35 range, produced until the 3.5L PM35/PNM35 replaced it in 2004 — real record dates here run 2001 to mid-2004, matching that changeover.'
    },
    'PM35': {
      id: 'PM35', chassisPrefix: 'PM35',
      generation: 'M35 (Stagea)',
      name: 'Nissan Stagea 350RX (PM35)',
      shortName: 'Stagea 350RX',
      chassisCode: 'CBA-PM35',
      bodyStyle: '5-Door Wagon',
      years: '2004 – 2007',
      engine: 'VQ35DE 3.5L NA V6',
      transmission: '5-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The 3.5L grade introduced in 2004 — believed rear-wheel-drive, distinguished in the FAST data from the AWD PNM35 by a separate chassis code.'
    },
    'PNM35': {
      id: 'PNM35', chassisPrefix: 'PNM35',
      generation: 'M35 (Stagea)',
      name: 'Nissan Stagea 350RX Four (PNM35)',
      shortName: 'Stagea 350RX (4WD)',
      chassisCode: 'CBA-PNM35',
      bodyStyle: '5-Door Wagon',
      years: '2004 – 2007',
      engine: 'VQ35DE 3.5L NA V6',
      transmission: '5-Speed Auto',
      drivetrain: 'ATTESA E-TS AWD',
      badgeClass: 'badge-nissan',
      description: 'The all-wheel-drive counterpart to PM35, same 3.5L VQ35DE.'
    },

    // =========================================================
    // NISSAN LEGENDS — Z32 GENERATION 300ZX / FAIRLADY Z (1989 – 2000)
    // =========================================================
    // Same source, same methodology. Five real chassis codes came out of
    // the binary cleanly, each confined to exactly one physical file with
    // 100% model-code suffix purity (no cross-contamination the way PS13
    // needed cleaning up). The letter scheme is well corroborated publicly
    // (Z32 Wiki / conceptzperformance.com, cross-checked against a second
    // enthusiast source): Z = 2-seater, G = 2+2, C = twin-turbo, H =
    // convertible, all on the VG30 V6.
    // This is JDM Fairlady Z data straight out of the Japan-market FAST
    // microfiche, not the worldwide 300ZX line — US/European-spec cars used
    // different VIN and body-code conventions entirely and are not in this
    // archive. Nissan Japan did build all five of the real-world Z32 body/
    // engine combinations (2-seat NA, 2-seat turbo, 2+2 NA, 2+2 turbo,
    // convertible), and each has its own clean chassis code below.
    //
    // Roof configuration (T-top vs. fixed-roof "slicktop") is a real factory
    // option on the 2-seat coupes only — the 2+2 was T-top-only in both
    // engines, and the convertible/slicktop were themselves mutually
    // exclusive body styles (per the Z32 Wiki "Chassis Differences" page,
    // conceptzperformance.com). It is NOT filterable here: the FAST model
    // code option string has no position with a confirmed public legend
    // pinning down roof type, and guessing at one would repeat the mistake
    // this decoder was rewritten to avoid (see modelDecoder.js header).
    'Z32': {
      id: 'Z32', chassisPrefix: 'Z32',
      generation: 'Z32 (300ZX)',
      name: 'Nissan Fairlady Z 2-Seat NA (Z32)',
      shortName: '300ZX 2-Seat (NA)',
      chassisCode: 'E-Z32',
      bodyStyle: '2-Door Coupe (2-seat)',
      years: '1989 – 2000',
      engine: 'VG30DE 3.0L NA V6 DOHC (222 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The base 2-seat naturally aspirated 300ZX, sold in Japan as the Fairlady Z. In the JDM, the 2-seat coupe was offered with either a T-top (removable glass roof panels) or a fixed-roof "slicktop" — the FAST model code does not carry a decodable roof-type field, so that split is not shown as a filter here.'
    },
    'GZ32': {
      id: 'GZ32', chassisPrefix: 'GZ32',
      generation: 'Z32 (300ZX)',
      name: 'Nissan Fairlady Z 2+2 NA (GZ32)',
      shortName: '300ZX 2+2 (NA)',
      chassisCode: 'E-GZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: '1989 – 2000',
      engine: 'VG30DE 3.0L NA V6 DOHC (222 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The longer-wheelbase 2+2 body on the naturally aspirated VG30DE — the highest-volume Z32 in this archive. The 2+2 was T-top only; Nissan never offered a fixed-roof "slicktop" on this body.'
    },
    'CZ32': {
      id: 'CZ32', chassisPrefix: 'CZ32',
      generation: 'Z32 (300ZX)',
      name: 'Nissan Fairlady Z 2-Seat Twin Turbo (CZ32)',
      shortName: '300ZX 2-Seat (Twin Turbo)',
      chassisCode: 'E-CZ32',
      bodyStyle: '2-Door Coupe (2-seat)',
      years: '1989 – 2000',
      engine: 'VG30DETT 3.0L Twin-Turbo V6 DOHC (280 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The 2-seat twin-turbo 300ZX — the VG30DETT most enthusiasts mean when they say "300ZX Turbo." Japan (unlike the US, where the slicktop was NA-only) offered the same T-top/slicktop choice on the turbo 2-seater; not decodable from the FAST code here.'
    },
    'HZ32': {
      id: 'HZ32', chassisPrefix: 'HZ32',
      generation: 'Z32 (300ZX)',
      name: 'Nissan Fairlady Z Convertible (HZ32)',
      shortName: '300ZX Convertible (NA)',
      chassisCode: 'E-HZ32',
      bodyStyle: '2-Door Convertible',
      years: '1991 – 1998',
      engine: 'VG30DE 3.0L NA V6 DOHC (222 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The factory soft-top convertible body, naturally aspirated only — no turbo-convertible chassis code exists in this archive, consistent with Nissan never offering one — and by far the rarest Z32 here.'
    },
    'GCZ32': {
      id: 'GCZ32', chassisPrefix: 'GCZ32',
      generation: 'Z32 (300ZX)',
      name: 'Nissan Fairlady Z 2+2 Twin Turbo (GCZ32)',
      shortName: '300ZX 2+2 (Twin Turbo)',
      chassisCode: 'E-GCZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: '1989 – 2000',
      engine: 'VG30DETT 3.0L Twin-Turbo V6 DOHC (280 PS)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The 2+2 twin-turbo — the largest single Z32 chassis code in this archive. T-top only, like every 2+2 — Nissan never offered a fixed-roof "slicktop" 2+2.'
    },

    // =========================================================
    // NISSAN LEGENDS — Z32 EXPORT MARKETS (300ZX, worldwide)
    // =========================================================
    // Everything above this section is JDM Fairlady Z data from
    // H:\AR-JP\JP. These six models are a genuinely different source:
    // H:\NISSAN\{US,CA,EL,ER}, Nissan's export-destination FAST archive,
    // which uses real 17-character NHTSA-style VINs instead of the JDM
    // chassis+serial scheme. US and CA VINs were independently verified
    // against the standard NHTSA check-digit algorithm — 89,194/89,195 (US)
    // and 2,848/2,848 (CA) pass, a single US anomaly is unresolved and left
    // as-is rather than corrected. EL and ER's VINs do NOT pass check-digit
    // validation (their reconstructed prefix is a shared literal, not a real
    // per-vehicle WMI/VDS) — they're real Nissan FAST records with a genuine
    // 300ZX chassis code, just not confirmed public VINs, and that caveat is
    // carried into their `destination` text and surfaced in the UI rather
    // than hidden.
    //
    // What's NOT available for any of these six, unlike the JDM records:
    // no confirmed factory option/model code (Factory Build Code reads "—"),
    // no turbo-vs-NA distinction (export FAST tags only Z32/GZ32 = seat
    // count, not engine), no T-top/slicktop split, and EL/ER have no
    // confirmed per-vehicle build year at all.
    //
    // "EL" and "ER" are Nissan's own literal internal destination codes
    // (confirmed via H:\NISSAN\FASTPRG\WIN\*\NSFASTKY.INI). What they stand
    // for is NOT confirmed anywhere in the source data — "Europe LHD" /
    // "Europe RHD" is an external inference from matching third-party Nissan
    // parts-catalog listings, corroborated but not internally verified, so
    // it's presented here as inferred, not fact.
    'Z32_US': {
      id: 'Z32_US', chassisPrefix: 'Z32_US',
      generation: 'Z32 Export (US / Canada)',
      name: 'Nissan 300ZX 2-Seat — US Market (Z32)',
      shortName: '300ZX 2-Seat (US)',
      chassisCode: 'Z32',
      bodyStyle: '2-Door Coupe (2-seat)',
      years: '1990 – 1996',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'United States',
      badgeClass: 'badge-nissan',
      description: 'US-market 300ZX 2-seat coupes, VIN reconstructed from the Nissan FAST export microfiche and independently validated against the NHTSA VIN check-digit algorithm (89,194 of 89,195 pass; one unresolved anomaly). No confirmed factory option code, turbo/NA split, or roof-type split for this dataset.'
    },
    'GZ32_US': {
      id: 'GZ32_US', chassisPrefix: 'GZ32_US',
      generation: 'Z32 Export (US / Canada)',
      name: 'Nissan 300ZX 2+2 — US Market (GZ32)',
      shortName: '300ZX 2+2 (US)',
      chassisCode: 'GZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: '1990 – 1996',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'United States',
      badgeClass: 'badge-nissan',
      description: 'US-market 300ZX 2+2 coupes, VIN reconstructed and NHTSA check-digit validated the same way as the 2-seat US entry. T-top only, like every 2+2 Z32.'
    },
    'Z32_CA': {
      id: 'Z32_CA', chassisPrefix: 'Z32_CA',
      generation: 'Z32 Export (US / Canada)',
      name: 'Nissan 300ZX 2-Seat — Canada Market (Z32)',
      shortName: '300ZX 2-Seat (Canada)',
      chassisCode: 'Z32',
      bodyStyle: '2-Door Coupe (2-seat)',
      years: '1990 – 1996',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'Canada',
      badgeClass: 'badge-nissan',
      description: 'Canadian-market 300ZX 2-seat coupes, VIN reconstructed from the Nissan FAST export microfiche — all 2,848 records independently pass NHTSA VIN check-digit validation.'
    },
    'GZ32_CA': {
      id: 'GZ32_CA', chassisPrefix: 'GZ32_CA',
      generation: 'Z32 Export (US / Canada)',
      name: 'Nissan 300ZX 2+2 — Canada Market (GZ32)',
      shortName: '300ZX 2+2 (Canada)',
      chassisCode: 'GZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: '1990 – 1996',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'Canada',
      badgeClass: 'badge-nissan',
      description: 'Canadian-market 300ZX 2+2 coupes — all 1,055 records independently pass NHTSA VIN check-digit validation. T-top only, like every 2+2 Z32.'
    },
    'GZ32_EL': {
      id: 'GZ32_EL', chassisPrefix: 'GZ32_EL',
      generation: 'Z32 Export (Destination "EL" / "ER" — market name inferred)',
      name: 'Nissan 300ZX 2+2 — Export Destination "EL" (GZ32)',
      shortName: '300ZX 2+2 ("EL")',
      chassisCode: 'GZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: 'Unknown — no per-vehicle build year decoded',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'Nissan FAST destination code "EL" — externally inferred as Europe (left-hand-drive) from third-party Nissan parts-catalog listings, not confirmed inside this dataset',
      badgeClass: 'badge-nissan',
      description: '4,209 genuine Nissan FAST records tagged GZ32 under destination code "EL". Their identifier does not pass NHTSA VIN check-digit validation — it is Nissan\'s internal FAST record key for this market, not a confirmed public VIN — and no per-vehicle build year survives in this dataset.'
    },
    'GZ32_ER': {
      id: 'GZ32_ER', chassisPrefix: 'GZ32_ER',
      generation: 'Z32 Export (Destination "EL" / "ER" — market name inferred)',
      name: 'Nissan 300ZX 2+2 — Export Destination "ER" (GZ32)',
      shortName: '300ZX 2+2 ("ER")',
      chassisCode: 'GZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: 'Unknown — no per-vehicle build year decoded',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'Nissan FAST destination code "ER" — externally inferred as Europe (right-hand-drive) from third-party Nissan parts-catalog listings, not confirmed inside this dataset',
      badgeClass: 'badge-nissan',
      description: '1,548 genuine Nissan FAST records tagged GZ32 under destination code "ER". Same caveats as destination "EL": identifier does not pass NHTSA VIN check-digit validation, and no per-vehicle build year survives in this dataset.'
    }
  },

  // ---- Which browsable models are "Nissan Legends" (not a Skyline) --------
  // Driven off the "NISSAN LEGENDS" section markers above rather than
  // hand-tagging every entry, so a new Legends model only has to be added
  // once, here, to be picked up everywhere this distinction matters (the
  // separate VIN browser tab, its own model strip, etc).
  _legendModelIds: [
    'S13', 'PS13', 'KPS13', 'KS13', 'RS13', 'S14', 'CS14',
    'WGC34', 'WHC34', 'WGNC34', 'WGNC34_260RS', 'NM35', 'HM35', 'PM35', 'PNM35',
    'Z32', 'GZ32', 'CZ32', 'HZ32', 'GCZ32',
    'Z32_US', 'GZ32_US', 'Z32_CA', 'GZ32_CA', 'GZ32_EL', 'GZ32_ER'
  ],
  isLegend: function(modelId) {
    return this._legendModelIds.includes(modelId);
  },

  // ---- Color name lookup ----
  colorNames: {
    'QM1': { name: 'White', hex: '#EEF0F2' },
    'KL0': { name: 'Spark Silver Metallic', hex: '#BFC5CA' },
    'KN6': { name: 'Dark Grey Pearl', hex: '#484C51' },
    'LP2': { name: 'Midnight Purple Pearl', hex: '#261330' },
    'AN0': { name: 'Super Clear Red II', hex: '#A81D23' },
    'BN6': { name: 'Deep Marine Blue Pearl', hex: '#0B2240' },
    'KH3': { name: 'Black Pearl', hex: '#111215' },
    'BT2': { name: 'Champion Blue', hex: '#1A5DAA' },
    'TV2': { name: 'Bayside Blue Metallic', hex: '#114B8C' },
    'LV4': { name: 'Midnight Purple II', hex: '#2A1838' },
    'LX0': { name: 'Midnight Purple III', hex: '#220D32' },
    'JW0': { name: 'Millennium Jade Metallic', hex: '#7D8577' },
    'EY0': { name: 'Silica Breath Metallic', hex: '#C2B89D' },
    'EV1': { name: 'Lightning Yellow', hex: '#E8C01D' },
    'AR1': { name: 'Red', hex: '#9E181E' },
    'AR2': { name: 'Active Red', hex: '#A81D23' },
    'KR4': { name: 'Sonic Silver Metallic', hex: '#D2D7DF' },
    'WV2': { name: 'Sparkling Silver Metallic', hex: '#9E9E9C' },
    'KH2': { name: 'Gun Grey Metallic', hex: '#4E5357' },
    '326': { name: 'Crystal White', hex: '#F2F4F7' },
    '732': { name: 'Black Pearl Metallic', hex: '#1C1F22' },
    'AH3': { name: 'Cranberry Red (P)', hex: '#8C1D24' },
    // '526' and '549' were previously mislabeled White and Dark Grey. Checked
    // against H:\AR-JP\JP\ABBR.TXT (the factory paint abbreviation table) on
    // 2026-08-18: 526 is RED and 549 is SILVER — corrected below.
    '526': { name: 'Red', hex: '#A81D23' },
    '549': { name: 'Silver', hex: '#C7CBCF' }
  },

  // ---- Sanitize raw FAST import artifacts ----
  // The FAST microfiche binaries use fixed-width fields left-padded with NUL
  // bytes, and that padding survived the H:\AR-JP\JP import into these JSON
  // files. A NUL left in `vin` or `m` silently breaks both model resolution
  // and chassis lookup, so strip control characters from every string field.
  _sanitizeRecord: function(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const clean = {};
    for (const k in rec) {
      const v = rec[k];
      clean[k] = (typeof v === 'string')
        ? v.replace(/[\x00-\x1F\x7F]/g, '').trim()
        : v;
    }
    return clean.vin ? clean : null;
  },

  // ---- Load the compact FAST exports ---------------------------------------
  loadFastData: async function() {
    if (this._loaded) return;

    const prefixes = [
      'bcnr33','bnr34','er34','enr34','hr34',
      'ecr33','er33','enr33','hr33',
      'bnr32','hcr32','hnr32','hr32','fr32',
      's13','ps13','ks13','rs13','s14','cs14',
      'wgc34','whc34','wgnc34','nm35','hm35','pm35','pnm35',
      'z32','gz32','cz32','hz32','gcz32',
      'z32_us','gz32_us','z32_ca','gz32_ca','gz32_el','gz32_er'
    ];

    const failed = [];

    try {
      const res = await fetch('data/paint.json');
      if (res.ok) this._paint = JSON.parse((await res.text()).replace(/^﻿/, ''));
    } catch (e) {
      // paint names are a nicety; codes still display without them
    }

    for (const p of prefixes) {
      const upper = p.toUpperCase();
      try {
        const res = await fetch(`data/fast_${p}.json`);
        if (!res.ok) { failed.push(`${upper} (HTTP ${res.status})`); continue; }

        // Decode by hand so a UTF-8 BOM never reaches JSON.parse.
        const doc = JSON.parse((await res.text()).replace(/^﻿/, ''));
        if (!doc || !Array.isArray(doc.r)) { failed.push(`${upper} (unexpected shape)`); continue; }

        const n = doc.r.length;
        const col = {
          n,
          blk: new Uint8Array(n),
          ser: new Int32Array(n),
          di:  new Uint16Array(n),
          ci:  new Uint16Array(n),
          ti:  new Uint8Array(n),
          mci: new Uint16Array(n),
          dict: { b: doc.b || ['0'], d: doc.d || [], c: doc.c || [], t: doc.t || [], mc: doc.mc || [] },
          ranges: {}
        };

        // Export-market records (US/CA/EL/ER 300ZX) carry a real per-record
        // VIN string instead of fitting the JDM chassis+block+serial scheme —
        // see the comment on `exportInfo` in models{} below for why they get
        // this separate path rather than being forced into the JDM template.
        if (Array.isArray(doc.vin) && doc.vin.length === n) {
          col.vin = doc.vin;
          col.vinIndex = new Map();
          for (let i = 0; i < n; i++) col.vinIndex.set(doc.vin[i], i);
        }
        if (doc.exportInfo) col.exportInfo = doc.exportInfo;

        for (let i = 0; i < n; i++) {
          const row = doc.r[i];
          col.blk[i] = row[0];
          col.ser[i] = row[1];
          col.di[i]  = row[2];
          col.ci[i]  = row[3];
          col.ti[i]  = row[4];
          col.mci[i] = row[5];
        }

        // Rows arrive sorted by (block, serial); record each block's span so a
        // chassis number can be found by binary search instead of a lookup map.
        for (let i = 0; i < n; i++) {
          const b = col.blk[i];
          if (!col.ranges[b]) col.ranges[b] = [i, i];
          col.ranges[b][1] = i;
        }

        this._cols[upper] = col;
        this._byPrefix[upper] = { length: n };
        this._totalRecords += n;
      } catch (e) {
        failed.push(`${upper} (${e.message})`);
      }
    }

    // Grade-split models (ER34_GT, ER34_GTT, ECR33_V, ...) share a physical
    // _cols entry with a sibling model, so they never get a _byPrefix entry
    // from the loop above. Backfill every `models` key here — cheap no-op for
    // the non-split majority (getModelRecordCount just returns col.n), and
    // gives the split entries a correct scoped count instead of 0. A model
    // that itself carries a gradeFilter (WGNC34 excluding its own 260RS
    // split, for instance) needs recomputing even though it already has a
    // _byPrefix entry — that entry is the raw unfiltered physical count.
    Object.keys(this.models).forEach(key => {
      if (!this._byPrefix[key] || this.models[key].gradeFilter) {
        this._byPrefix[key] = { length: this.getModelRecordCount(key) };
      }
    });

    this._loaded = true;
    this.loadError = null;

    console.log(`BPZILLA: loaded ${this._totalRecords.toLocaleString()} factory records across ${Object.keys(this._cols).length} chassis.`);
    if (failed.length) console.error('BPZILLA: failed to load —', failed.join(', '));

    if (this._totalRecords === 0) {
      // Almost always this: the page was opened by double-clicking index.html.
      // Browsers block fetch() for file:// URLs, so every data file fails.
      this.loadError = (location.protocol === 'file:')
        ? 'Opened directly from disk (file://), so the browser blocked loading the factory data. Run server.ps1 and open http://localhost:8080/ instead.'
        : `No factory records could be loaded. ${failed.length ? 'Failed files: ' + failed.join(', ') : 'Check that the data/ folder sits next to index.html.'}`;
      console.error('BPZILLA: ' + this.loadError);
    }
  },

  // ---- Grade-split model resolution -----------------------------------------
  // Two chassis (ER34, ECR33) present as more than one browsable `models`
  // entry backed by a single physical FAST file. `chassisPrefix` says which
  // _cols entry actually holds the rows; `gradeFilter`, if set, is the single
  // factory-code character (position 4) that a row must have to belong to
  // that model. Every other model has chassisPrefix === its own key and no
  // gradeFilter, so this is a no-op for the non-split majority.
  _resolvePhysical: function(modelId) {
    const model = this.models[modelId];
    if (!model) return null;
    const physicalId = model.chassisPrefix || modelId;
    const col = this._cols[physicalId];
    if (!col) return null;
    return { col, physicalId, filterChar: model.gradeFilter || null };
  },

  // Does row i of a (physical) column belong to a given grade-split model?
  // Always true for non-split models (filterChar is null).
  // filterChar is normally a single character checked at position 4 (the
  // original ER34_GT/ECR33_V-style split). It can also encode a different
  // position and/or a negation as "pos:char" or "pos:!char" — e.g. WGNC34's
  // 260RS split lives at position 12, not 4, so it's "12:P" / "12:!P".
  // Shared by _rowMatches and _virtualModelFor so both stay in sync.
  _matchesFilter: function(mc, filterChar) {
    if (!filterChar) return false;
    const m = /^(\d+):(!?)(.+)$/.exec(filterChar);
    if (m) {
      const pos = parseInt(m[1], 10);
      const negate = m[2] === '!';
      const target = m[3];
      return negate ? mc[pos] !== target : mc[pos] === target;
    }
    return mc[4] === filterChar;
  },

  _rowMatches: function(col, i, filterChar) {
    if (!filterChar) return true;
    const mc = col.dict.mc[col.mci[i]] || '';
    return this._matchesFilter(mc, filterChar);
  },

  // Given a physical chassis prefix and a specific factory code, which
  // browsable model does it belong to? For split chassis this picks the
  // sibling whose gradeFilter matches; for everything else there's exactly
  // one models entry per chassisPrefix, so it's returned directly.
  _virtualModelFor: function(physicalId, mc) {
    const candidates = Object.keys(this.models).filter(k =>
      (this.models[k].chassisPrefix || k) === physicalId);
    if (candidates.length <= 1) return candidates[0] || physicalId;
    const match = candidates.find(k => this._matchesFilter(mc || '', this.models[k].gradeFilter));
    return match || candidates[0];
  },

  // Cached record count for a (possibly grade-filtered) model — used anywhere
  // that just needs "how many cars is this", without materializing them.
  _splitCounts: {},
  getModelRecordCount: function(modelId) {
    const resolved = this._resolvePhysical(modelId);
    if (!resolved) return 0;
    if (!resolved.filterChar) return resolved.col.n;
    if (this._splitCounts[modelId] !== undefined) return this._splitCounts[modelId];
    let n = 0;
    for (let i = 0; i < resolved.col.n; i++) {
      if (this._rowMatches(resolved.col, i, resolved.filterChar)) n++;
    }
    this._splitCounts[modelId] = n;
    return n;
  },

  // ---- Build a display record from the columnar store ----------------------
  _materialize: function(modelId, i) {
    const resolved = this._resolvePhysical(modelId);
    if (!resolved || i < 0 || i >= resolved.col.n) return null;
    const col = resolved.col;
    const physicalId = resolved.physicalId;

    const model = this.models[modelId];
    const block = col.dict.b[col.blk[i]] || '0';
    const serial = col.ser[i];
    const code = col.dict.c[col.ci[i]] || '';
    const date = col.dict.d[col.di[i]] || '';
    const name = this._paint[code] || (this.colorNames[code] || {}).name || code;
    const hex = (this.colorNames[code] || {}).hex || this._swatchFor(code, name);

    // Export-market records (US/CA/EL/ER) carry a real reconstructed VIN in
    // col.vin rather than the JDM chassis+block+serial scheme, and US/CA VINs
    // are independently NHTSA check-digit validated while EL/ER are not — see
    // js/database.js models{} "NISSAN LEGENDS — Z32 EXPORT MARKETS" comment.
    if (col.vin) {
      const vin = col.vin[i];
      const info = col.exportInfo || {};
      const marketName = (model || {}).destination || info.region || 'export market';
      const confirmed = info.vinConfirmedTotal > 0 && info.vinConfirmedCount === info.vinConfirmedTotal;
      return {
        chassisNumber: vin,
        plateNumber: vin,
        modelId: modelId,
        seriesBlock: block,
        modelCode: '',
        modelName: model ? model.name : modelId,
        series: model ? model.shortName : '',
        grade: '',
        buildDate: date,
        colorCode: code,
        colorName: name,
        colorHex: hex,
        interiorCode: '',
        transmission: model ? model.transmission : '',
        destination: marketName,
        status: confirmed ? '✅ VIN Validated (NHTSA Check Digit)' : '⚠️ Reconstructed Identifier — Not Publicly VIN-Verifiable',
        notes: confirmed
          ? `Reconstructed from the Nissan FAST export-market microfiche and independently validated against the standard NHTSA VIN check-digit algorithm.`
          : `Reconstructed from the Nissan FAST export-market microfiche. This is Nissan's internal chassis/sequence identifier for this market and does not pass NHTSA VIN check-digit validation, so treat it as a FAST record key, not a confirmed public VIN.`
      };
    }

    return {
      // The physical chassis prefix, never the (possibly grade-split) model
      // id, so the chassis number always matches what's actually stamped on
      // the car — an ER34_GT and an ER34_GTT car both read "ER34-######".
      chassisNumber: `${physicalId}${block}-${String(serial).padStart(6, '0')}`,
      plateNumber: `${physicalId}-${String(serial).padStart(6, '0')}`,
      modelId: modelId,
      seriesBlock: block,
      modelCode: col.dict.mc[col.mci[i]] || '',
      modelName: model ? model.name : modelId,
      series: this._decodeSeries(physicalId, block, date, serial),
      grade: this._decodeGrade(physicalId, col.dict.mc[col.mci[i]] || ''),
      buildDate: date,
      colorCode: code,
      colorName: name,
      colorHex: hex,
      interiorCode: col.dict.t[col.ti[i]] || '',
      transmission: this._decodeTransmission(physicalId, col.dict.mc[col.mci[i]] || '') || (model ? model.transmission : ''),
      destination: 'Japan Domestic Market (JDM)',
      status: '✅ Genuine FAST Record',
      notes: `Nissan FAST microfiche verified. Factory stamped ${date}.`
    };
  },

  // Swatch for paint codes with no curated hex. Where the factory abbreviation
  // table (data/paint.json) at least names the base colour family — "White",
  // "Blue Metallic", "Red / Black" — that beats a random hash colour, so this
  // reads the family out of the name first. Only codes with no name at all
  // (the handful not found in the source table) fall back to the old
  // deterministic muted hash, so they're visually distinct but not misleading.
  _familyHex: {
    white: '#EEF0F2', black: '#1C1F22', silver: '#C7CBCF', gray: '#7B8188',
    grey: '#7B8188', blue: '#1A5DAA', red: '#A81D23', green: '#2F6B4F',
    yellow: '#E8C01D', gold: '#B8944D', purple: '#3A2050', pearl: '#DCD8CE'
  },
  _swatchFor: function(code, name) {
    if (name) {
      const first = String(name).toLowerCase().split(/[\s/(]/)[0];
      if (this._familyHex[first]) return this._familyHex[first];
    }
    let h = 0;
    for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0xffff;
    return `hsl(${h % 360}, 12%, 55%)`;
  },

  // ---- Chassis lookup ------------------------------------------------------
  // Accepts what is stamped on the car (BNR34-000051) as well as the fully
  // qualified FAST key (BNR344-000051). FAST restarts serial numbers in each
  // series block, so a plain chassis number can legitimately match more than
  // one record; findChassis returns every candidate, resolveChassis the first.
  _findExportVin: function(clean) {
    for (const physicalId in this._cols) {
      const col = this._cols[physicalId];
      if (!col.vinIndex) continue;
      const i = col.vinIndex.get(clean);
      if (i === undefined) continue;
      const virtualId = this._virtualModelFor(physicalId, col.dict.mc[col.mci[i]] || '');
      return this._materialize(virtualId, i);
    }
    return null;
  },

  findChassis: function(input) {
    if (!input) return [];
    const clean = String(input).toUpperCase().replace(/[\s_]/g, '');

    // Export-market records (US/CA/EL/ER 300ZX) use a real reconstructed VIN
    // as their identifier, not the JDM chassis+block+serial scheme below, so
    // an exact VIN match is checked first.
    const exportHit = this._findExportVin(clean);
    if (exportHit) return [exportHit];

    const m = clean.match(/^([A-Z]+[0-9]{2})([0-9])?-?([0-9]{1,7})$/);
    if (!m) return [];

    // A physical chassis prefix — what's actually stamped on the car — never
    // a grade-split model id, since a VIN alone doesn't say GT vs GT-t.
    const physicalId = m[1];
    const block = m[2];
    const serial = parseInt(m[3], 10);
    const col = this._cols[physicalId];
    if (!col) return [];

    const hits = [];
    for (const b of Object.keys(col.ranges)) {
      const blockChar = col.dict.b[b] || '0';
      if (block !== undefined && block !== null && block !== '' && blockChar !== block) continue;
      const [lo, hi] = col.ranges[b];
      const i = this._bsearch(col.ser, lo, hi, serial);
      if (i >= 0) {
        const mc = col.dict.mc[col.mci[i]] || '';
        const virtualId = this._virtualModelFor(physicalId, mc);
        hits.push(this._materialize(virtualId, i));
      }
    }
    return hits;
  },

  resolveChassis: function(input) {
    const hits = this.findChassis(input);
    if (!hits.length) return null;
    if (hits.length > 1) hits[0].alsoMatched = hits.length - 1;
    return hits[0];
  },

  _bsearch: function(arr, lo, hi, want) {
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = arr[mid];
      if (v === want) return mid;
      if (v < want) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  },

  _getModelId: function(prefix) {
    return this.models[prefix] ? prefix : null;
  },

  // ---- Series, derived from the FAST block, or the serial where a chassis
  // ---- occupies a single block (BCNR33 is the notable case) ----------------
  _decodeSeries: function(modelId, block, date, serial) {
    const label = this.seriesNames[modelId] && this.seriesNames[modelId][block];
    if (label) return `${label} (${date})`;

    const cuts = this.seriesSerials[modelId];
    if (cuts && typeof serial === 'number') {
      for (let i = cuts.length - 1; i >= 0; i--) {
        if (serial >= cuts[i][0]) return `${cuts[i][1]} (${date})`;
      }
    }
    return date || '';
  },

  // Serial thresholds for chassis that FAST keeps in one block.
  seriesSerials: {
    'BCNR33': [[1, 'Series 1'], [20001, 'Series 2'], [40001, 'Series 3']]
  },

  // ---- Grade, derived from the 20-character factory model code -------------
  // Confirmed against BCNR33, where position 4 carries Q (standard) or W (V-Spec).
  //
  // Position 4 only works for "positional" layouts (R33/R34-style: option
  // string first, chassis marker embedded mid-code). "Chassis-led" layouts
  // (R32, Silvia's S13 family, 180SX, Z32 — chassis fragment spelled out at
  // the very start) push the chassis text itself through position 4, so the
  // grade slot lands somewhere else. BNR32 is confirmed: position 6 is 'X'
  // (Standard GT-R) before Feb 1993 essentially without exception, then 'B'
  // (V-Spec) appears and stays in real volume from 1993-02 onward — matching
  // the real V-Spec I launch date (3 Feb 1993) exactly, independently of
  // this project. See gradePositions for other chassis-led models — none
  // else are confirmed yet, so they still fall back to the generic path.
  gradePositions: {
    'BNR32': 6
  },
  // Silvia grade family (K's/Q's/J's) — confirmed by exact-match cross-
  // reference against s-chassis-archive.com's independently published
  // S13/KS13/PS13/KPS13 production totals by grade+series: every bucket
  // below landed within the same ~0.3-0.5% variance seen across every
  // other total in this dataset (different snapshot of the same factory
  // records), several matching to the exact record (e.g. KPS13's three
  // families hit 6565/5627/5 against a source total of 6565/5627/5 with
  // zero variance). 'Club' is a further split confirmed the same way, but
  // only isolable on the SR20 (PS13/KPS13) chassis — a single 'E' flag at
  // grade-position+2 (Q's) or +3 (K's) exactly matches the source's Q's
  // Club / K's Club subtotals on both chassis. The CA18 (S13/KS13) chassis
  // has real 'Diamond' sub-grades too per the same source, and PS13 has a
  // real 'Almighty'/'Square' sub-grade, but no letter position was found
  // that isolates any of them cleanly — they stay folded into their parent
  // grade rather than guessed at.
  _decodeSilviaGrade: function(modelId, mc) {
    if (modelId === 'S13' || modelId === 'KS13') {
      const c = mc[2];
      if (c === 'H') return "Q's";
      if (c === 'J') return "K's";
      if (c === 'F' || c === 'A') return "J's";
      return '';
    }
    if (modelId === 'PS13') {
      const shift = (mc[0] === 'K') ? 1 : 0;
      const gp = 3 + shift;
      const c = mc[gp];
      if (c === 'H') return (mc[gp + 2] === 'E') ? "Q's Club" : "Q's";
      if (c === 'J') return (mc[gp + 3] === 'E') ? "K's Club" : "K's";
      if (c === 'F' || c === 'A') return "J's";
      return '';
    }
    return null;
  },
  _decodeGrade: function(modelId, mc) {
    const silvia = this._decodeSilviaGrade(modelId, mc);
    if (silvia !== null) return silvia;
    const pos = this.gradePositions[modelId] || 4;
    if (mc.length <= pos) return '';
    const table = this.gradeCodes[modelId];
    if (table && table[mc[pos]]) return table[mc[pos]];

    // No confirmed English name for this model. Position 4 is only a real
    // option/grade slot on "positional" layouts (R33/R34-style codes: option
    // string first, chassis marker embedded mid-code) — Skyline R32,
    // Silvia's S13 family, the 180SX and Z32 all use "chassis-led" codes
    // instead (chassis fragment right at the start), where position 4 is
    // part of that echoed chassis text, not an option field. Showing it as
    // a grade there would just be wrong, so this only falls back to the raw
    // character on a confirmed positional layout, and stays blank
    // otherwise — no filter is better than a misleading one.
    if (pos !== 4) return '';
    const layouts = (window.MODEL_DECODER || {}).LAYOUTS;
    if (!layouts || layouts[mc.slice(-3)] !== 'positional') return '';
    const ch = mc[4];
    return (ch && ch !== ' ' && ch !== '-') ? `Grade ${ch}` : '';
  },

  gradeCodes: {
    'BCNR33': { 'Q': 'Standard GT-R', 'W': 'V-Spec' },
    'BNR34':  { 'W': 'V-Spec', 'V': 'Standard GT-R' },
    // BNR32 — position 6 (see gradePositions). 'B' covers V-Spec broadly
    // (V-Spec I from Feb 1993, V-Spec II from Jan 1994 — this character
    // does not distinguish the two) rather than any narrower sub-grade;
    // real total 2,829 'B' records is consistent with V-Spec I + II
    // combined, not just the ~1,453 V-Spec I figure alone. 6 stray 'B'
    // records before Feb 1993 (Jun/Sep/Dec 1992, Jan 1993) are almost
    // certainly pre-production samples, not a real early run.
    'BNR32':  { 'X': 'Standard GT-R', 'B': 'V-Spec' },
    // ER34 carries both the NA 25GT and the turbo 25GT-t under one chassis
    // code — position 4 is 'E' for every naturally aspirated record and 'T'
    // for every turbo record, checked against all 37,266 FAST ER34 rows
    // (67.4% T, 32.6% E, no other characters appear at this position). Now
    // that ER34_GT / ER34_GTT are separate browsable models (see models
    // above), this table is what tells the two apart when loading the file.
    'ER34':   { 'T': '25GT-t (Turbo)', 'E': '25GT (NA)' },
    // Same idea for ECR33's two grades — see the ECR33_V model entry for
    // what's known (and not known) about what 'V' represents.
    'ECR33':  { 'T': 'GTS25-t', 'V': 'GTS25-t (Type V)' }
  },

  // ---- Transmission, decoded from the factory model code -------------------
  // 'F' = 5-speed manual, 'A' = 4-speed automatic on every GTS-trim R32/R33/
  // R34 Skyline checked. Confirmed structurally, not just by letter-matching:
  // every GT-R chassis in every generation is CONSTANT at a single value with
  // zero exceptions — BNR32 100% 'F' (43,893/43,895, 2 stray blanks), BCNR33
  // 100% 'F' (16,560/16,560, same 5-speed architecture as R32), BNR34 100%
  // 'Y' (11,474/11,474, the newer Getrag 6-speed introduced for R34) — which
  // is exactly what "GT-R never offered an automatic, in any generation" (a
  // real, well-documented fact) predicts, and R32/R33 sharing 'F' while R34
  // alone uses 'Y' tracks the real transmission architecture change. Every
  // GTS-trim chassis checked (HCR32, HNR32, HR32, FR32, ENR33, HR33, ENR34,
  // HR34, ER34_GT, ER34_GTT) shows a genuine two-way F/A split spanning the
  // entire production run on both sides — a standing customer choice, not a
  // running change.
  //
  // ER33 and ECR33 (GTS25 / GTS25-t) are the exception: alongside F/A they
  // also carry 'N' on early production only (1993-02 to 1995-12, then never
  // again through the end of production in 1998) — a clean running-change
  // boundary, so it's real, but what 'N' itself encoded isn't confirmed.
  // Those records report unknown transmission rather than a guess.
  //
  // Position differs by code layout: R33/R34 ("positional") have it at a
  // fixed index; R32 ("chassis-led") has the chassis text itself at the
  // front, sometimes with an extra leading 'R' marker, so the option field
  // start has to be computed per-record — see _decodeTransmission.
  // Keyed by physical chassis id, not the (possibly grade-split) browsable
  // model id — _decodeTransmission is always called with physicalId, same
  // as gradeCodes above. ER34_GT/ER34_GTT both resolve to physical 'ER34'.
  //
  // Same pattern, same F/A letters, confirmed the same way on the rest of
  // the Nissan Legends archive too:
  //   Silvia (S13, KS13, RS13, S14, CS14) — clean F/A split, full production
  //   span on both sides, same as every Skyline chassis above. PS13 has a
  //   real complication: ~11% of its records use a different chassis-prefix
  //   spelling ("K..." instead of "S...") that shifts this position by one,
  //   so that minority reports no transmission rather than a wrong one —
  //   not fixed here, flagged for a future pass.
  //   Stagea WGC34 and WHC34 (the 2WD/base grades) are constant 'A' with
  //   zero exceptions across 55,298 and 14,674 records — automatic only,
  //   which fits their real-world positioning as the family-wagon grades.
  //   WGNC34 (the AWD/turbo grade Autech used as the 260RS base) is the one
  //   Stagea chassis with a genuine F/A split, consistent with being the
  //   enthusiast-oriented grade. The newer M35-generation Stagea (NM35 and
  //   siblings) use a visibly different code scheme at this position — not
  //   guessed at, left undecoded.
  //   Z32 (300ZX) — checked, no clean signal found in the option string;
  //   also left undecoded rather than forced.
  // KPS13 (the K-prefixed "KS13..." minority inside the physical PS13 file)
  // isn't listed here — it shares physicalId 'PS13' with plain PS13 records,
  // so _decodeTransmission special-cases it directly (mc[0]==='K' shifts the
  // position by +1: verified against 12,192/12,197 K-records cleanly
  // matching F/A at PS13's position + 1).
  transmissionPositions: {
    'BCNR33': 5, 'ECR33': 5, 'ER33': 5, 'ENR33': 5, 'HR33': 5,
    'BNR34':  5, 'ENR34': 5, 'HR34': 5, 'ER34': 5,
    'S13': 3, 'PS13': 4, 'KS13': 3, 'RS13': 4, 'S14': 5, 'CS14': 5,
    'WGC34': 5, 'WHC34': 5, 'WGNC34': 5
  },
  transmissionR32Models: ['BNR32', 'HCR32', 'HNR32', 'HR32', 'FR32'],
  // 'F'/'A' are confirmed on every chassis in transmissionPositions/
  // transmissionR32Models. 'Y' is BNR34-only (its distinct 6-speed Getrag) —
  // kept out of the shared table so an unrelated model that happens to reuse
  // the letter 'Y' at its own transmission position (PS13 does) doesn't get
  // mislabeled "6-Speed Manual" too.
  transmissionCodes: {
    'F': '5-Speed Manual',
    'A': '4-Speed Automatic'
  },
  transmissionCodesByModel: {
    'BNR34': { 'Y': '6-Speed Manual' }
  },
  _decodeTransmission: function(modelId, mc) {
    if (!mc) return '';
    let ch;
    // KPS13 records live inside the physical 'PS13' file with a leading 'K'
    // ("KS13HFW..." vs "S13HFW...") that shifts every field after it by one
    // character — same H/J-then-F/A shape as plain S13, just offset by 1.
    if (modelId === 'PS13' && mc[0] === 'K') {
      ch = mc[this.transmissionPositions.PS13 + 1];
    } else if (this.transmissionPositions[modelId] !== undefined) {
      ch = mc[this.transmissionPositions[modelId]];
    } else if (this.transmissionR32Models.includes(modelId)) {
      const MD = window.MODEL_DECODER;
      const span = MD && MD._chassisSpan(mc, 'R32');
      if (!span) return '';
      const skip = (mc[span.end] === 'R') ? 2 : 1;
      ch = mc[span.end + skip];
    } else {
      return '';
    }
    const modelOverride = this.transmissionCodesByModel[modelId];
    if (modelOverride && modelOverride[ch]) return modelOverride[ch];
    return this.transmissionCodes[ch] || '';
  },

  // FAST splits each chassis into series blocks and restarts the serial in each.
  seriesNames: {
    'BNR34':  { '0': 'Series 1', '4': 'Series 2' },
    'ENR34':  { '0': 'Series 1', '3': 'Series 2' },
    'HR34':   { '0': 'Series 1', '1': 'Series 2' },
    'ER34':   { '0': 'Series 1', '2': 'Series 2' },
    'ECR33':  { '0': 'Series 1', '1': 'Series 2' },
    'ENR33':  { '0': 'Series 1', '2': 'Series 2' },
    'HR33':   { '0': 'Series 1', '1': 'Series 2' },
    'BNR32':  { '0': 'Series 1', '1': 'Series 1', '2': 'Series 2', '3': 'Series 3' },
    'HCR32':  { '0': 'Series 1', '2': 'Series 2' },
    'HR32':   { '0': 'Series 1', '1': 'Series 2' },

    // Export-market Z32 models use the model-year as their "block" (there's
    // no JDM-style series/block field for these), so this just echoes it
    // back instead of the generic "Block <value>" fallback.
    ...(() => {
      const years = { '1990':'1990','1991':'1991','1992':'1992','1993':'1993','1994':'1994','1995':'1995','1996':'1996','Unknown':'Unknown' };
      const out = {};
      ['Z32_US', 'GZ32_US', 'Z32_CA', 'GZ32_CA', 'GZ32_EL', 'GZ32_ER'].forEach(m => { out[m] = years; });
      return out;
    })()
  },

  // ---- Paged, filtered access ---------------------------------------------
  getVirtualPage: function(params) {
    const {
      modelId = 'BCNR33',
      page = 1,
      pageSize = 25,
      search = '',
      seriesFilter = 'ALL',
      gradeFilter = 'ALL',
      colorFilter = 'ALL',
      yearFilter = 'ALL',
      transmissionFilter = 'ALL'
    } = params;

    // 'ALL' walks every browsable model (this.models), not every physical
    // file (this._cols) — that's what keeps a removed chassis like R31 out
    // of the aggregate view, and what makes a grade-split model like
    // ER34_GT show up as its own bucket instead of doubling ER34's rows.
    // 'ALL_SKYLINE' / 'ALL_LEGENDS' are the same idea, scoped to one side of
    // the Skyline / Nissan Legends split.
    let ids;
    if (modelId === 'ALL') ids = Object.keys(this.models);
    else if (modelId === 'ALL_SKYLINE') ids = Object.keys(this.models).filter(k => !this.isLegend(k));
    else if (modelId === 'ALL_LEGENDS') ids = Object.keys(this.models).filter(k => this.isLegend(k));
    else ids = [modelId];
    const q = search ? String(search).toUpperCase().replace(/[\s_]/g, '') : '';

    // Walk the columns and collect only the matching indices, so a filtered
    // view over the archive never allocates one object per record up front.
    const matches = [];
    for (const id of ids) {
      const resolved = this._resolvePhysical(id);
      if (!resolved) continue;
      const { col, physicalId, filterChar } = resolved;
      for (let i = 0; i < col.n; i++) {
        if (!this._rowMatches(col, i, filterChar)) continue;
        if (colorFilter !== 'ALL' && col.dict.c[col.ci[i]] !== colorFilter) continue;
        if (seriesFilter !== 'ALL' && (col.dict.b[col.blk[i]] || '0') !== seriesFilter) continue;
        if (yearFilter !== 'ALL' && (col.dict.d[col.di[i]] || '').slice(0, 4) !== yearFilter) continue;
        if (gradeFilter !== 'ALL') {
          if (this._decodeGrade(physicalId, col.dict.mc[col.mci[i]] || '') !== gradeFilter) continue;
        }
        if (transmissionFilter !== 'ALL') {
          if (this._decodeTransmission(physicalId, col.dict.mc[col.mci[i]] || '') !== transmissionFilter) continue;
        }
        if (q) {
          const code = col.dict.c[col.ci[i]] || '';
          const name = (this._paint[code] || '').toUpperCase();
          if (col.vin) {
            const vin = col.vin[i].toUpperCase();
            if (!vin.includes(q) && !code.includes(q) && !name.includes(q)) continue;
          } else {
            const block = col.dict.b[col.blk[i]] || '0';
            const vin = `${physicalId}${block}-${String(col.ser[i]).padStart(6, '0')}`;
            const mc = (col.dict.mc[col.mci[i]] || '').toUpperCase();
            if (!vin.includes(q) && !vin.replace(`${physicalId}${block}`, physicalId).includes(q) &&
                !code.includes(q) && !name.includes(q) && !mc.includes(q)) continue;
          }
        }
        matches.push([id, i]);
      }
    }

    const total = matches.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;

    const records = matches.slice(start, start + pageSize)
                           .map(([id, i]) => this._materialize(id, i));

    return { records, totalRecords: total, page: safePage, totalPages };
  },

  // ---- Aggregate statistics ------------------------------------------------
  getModelStats: function(modelId) {
    const resolved = this._resolvePhysical(modelId);
    if (!resolved || !resolved.col.n) return null;
    const { col, physicalId, filterChar } = resolved;

    const colorCounts = new Map();
    const gradeCounts = new Map();
    const yearCounts = new Map();
    const blockCounts = new Map();
    const transmissionCounts = new Map();
    let totalCount = 0;

    for (let i = 0; i < col.n; i++) {
      if (!this._rowMatches(col, i, filterChar)) continue;
      totalCount++;

      const c = col.dict.c[col.ci[i]] || '';
      colorCounts.set(c, (colorCounts.get(c) || 0) + 1);

      const mc = col.dict.mc[col.mci[i]] || '';
      const g = this._decodeGrade(physicalId, mc);
      if (g) gradeCounts.set(g, (gradeCounts.get(g) || 0) + 1);

      const t = this._decodeTransmission(physicalId, mc);
      if (t) transmissionCounts.set(t, (transmissionCounts.get(t) || 0) + 1);

      const yr = (col.dict.d[col.di[i]] || '').substring(0, 4) || 'Unknown';
      yearCounts.set(yr, (yearCounts.get(yr) || 0) + 1);

      const b = col.dict.b[col.blk[i]] || '0';
      blockCounts.set(b, (blockCounts.get(b) || 0) + 1);
    }

    if (!totalCount) return null;
    const pct = n => ((n / totalCount) * 100).toFixed(1);

    const colorBreakdown = [...colorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => {
        const name = this._paint[code] || (this.colorNames[code] || {}).name || code;
        return {
          code,
          name,
          hex: (this.colorNames[code] || {}).hex || this._swatchFor(code, name),
          count,
          percent: pct(count)
        };
      });

    const gradeBreakdown = [...gradeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([grade, count]) => ({ grade, count, percent: pct(count) }));

    const transmissionBreakdown = [...transmissionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([transmission, count]) => ({ transmission, count, percent: pct(count) }));

    const productionByYear = [...yearCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, count]) => ({ year, count }));

    const seriesBreakdown = [...blockCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([block, count]) => ({
        block,
        label: (this.seriesNames[physicalId] && this.seriesNames[physicalId][block]) || `Block ${block}`,
        count,
        percent: pct(count)
      }));

    return { totalCount, colorBreakdown, gradeBreakdown, transmissionBreakdown, productionByYear, seriesBreakdown };
  },

  // ---- Grade/series x paint code cross-tabulation ---------------------------
  // The color and grade breakdowns above are each one dimension at a time.
  // This answers the denser question — "how many V-Spec II cars in KH2" — in
  // one cell, the same shape old-registry production-number tables used.
  // Row label combines grade with series only where series is itself known
  // for this physical chassis (seriesNames), so a chassis with no series
  // table just gets plain grade rows instead of a misleading "(Series ?)".
  getGradeColorMatrix: function(modelId) {
    const resolved = this._resolvePhysical(modelId);
    if (!resolved || !resolved.col.n) return null;
    const { col, physicalId, filterChar } = resolved;

    const rowColorCounts = new Map();   // rowLabel -> Map(colorCode -> count)
    const rowTotals = new Map();
    const colTotals = new Map();
    let grandTotal = 0;

    for (let i = 0; i < col.n; i++) {
      if (!this._rowMatches(col, i, filterChar)) continue;
      const code = col.dict.c[col.ci[i]] || '';
      if (!code) continue;

      const mc = col.dict.mc[col.mci[i]] || '';
      const grade = this._decodeGrade(physicalId, mc) || 'Unknown';
      const block = col.dict.b[col.blk[i]] || '0';
      // Series is tracked two different ways depending on chassis — a block
      // character (most models) or a serial-number threshold (BCNR33) — see
      // _decodeSeries above, which this mirrors minus the build-date suffix
      // that's useful per-record but not useful as a row-grouping label.
      let seriesLabel = (this.seriesNames[physicalId] || {})[block];
      if (!seriesLabel) {
        const cuts = this.seriesSerials[physicalId];
        if (cuts) {
          const serial = col.ser[i];
          for (let s = cuts.length - 1; s >= 0; s--) {
            if (serial >= cuts[s][0]) { seriesLabel = cuts[s][1]; break; }
          }
        }
      }
      const rowLabel = seriesLabel ? `${grade} (${seriesLabel})` : grade;

      if (!rowColorCounts.has(rowLabel)) rowColorCounts.set(rowLabel, new Map());
      const cellMap = rowColorCounts.get(rowLabel);
      cellMap.set(code, (cellMap.get(code) || 0) + 1);

      rowTotals.set(rowLabel, (rowTotals.get(rowLabel) || 0) + 1);
      colTotals.set(code, (colTotals.get(code) || 0) + 1);
      grandTotal++;
    }

    if (!grandTotal) return null;

    const cols = [...colTotals.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => ({
      code,
      name: this._paint[code] || (this.colorNames[code] || {}).name || code,
      total: colTotals.get(code)
    }));

    const rows = [...rowTotals.entries()].sort((a, b) => b[1] - a[1]).map(([label, total]) => ({
      label,
      total,
      cells: cols.map(c => rowColorCounts.get(label).get(c.code) || 0)
    }));

    return { rows, cols, grandTotal, multiDimensional: rows.length > 1 };
  },

  // ---- Every paint code across the whole archive, with a per-chassis count
  // breakdown for each one. This is the archive-wide complement to
  // getModelStats().colorBreakdown (which is scoped to a single chassis) — it
  // answers "what colors exist at all, and which cars actually came in them."
  getAllColorsBreakdown: function() {
    const byCode = new Map(); // code -> { count, byModel: Map(virtualModelId -> count) }

    Object.keys(this._cols).forEach(physicalId => {
      const col = this._cols[physicalId];
      for (let i = 0; i < col.n; i++) {
        const code = col.dict.c[col.ci[i]] || '';
        if (!code) continue;
        // Bucket by the browsable (possibly grade-split) model, not the raw
        // physical file, so ER34's colors land under ER34_GT / ER34_GTT
        // rather than a plain "ER34" that no longer exists in this.models.
        const mc = col.dict.mc[col.mci[i]] || '';
        const virtualId = this._virtualModelFor(physicalId, mc);
        if (!byCode.has(code)) byCode.set(code, { count: 0, byModel: new Map() });
        const entry = byCode.get(code);
        entry.count++;
        entry.byModel.set(virtualId, (entry.byModel.get(virtualId) || 0) + 1);
      }
    });

    const total = this._totalRecords || 1;
    const rows = [...byCode.entries()].map(([code, entry]) => {
      const name = this._paint[code] || (this.colorNames[code] || {}).name || code;
      const hex = (this.colorNames[code] || {}).hex || this._swatchFor(code, name);
      const models = [...entry.byModel.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([modelId, count]) => ({
          modelId,
          shortName: (this.models[modelId] || {}).shortName || modelId,
          count,
          percent: (count / entry.count * 100).toFixed(1)
        }));
      return {
        code, name, hex,
        count: entry.count,
        percent: (entry.count / total * 100).toFixed(2),
        named: !!(this._paint[code] || this.colorNames[code]),
        models
      };
    });

    rows.sort((a, b) => b.count - a.count);
    return rows;
  },

  // ---- Distinct filter values for a model ---------------------------------
  getFilterValues: function(modelId) {
    const resolved = this._resolvePhysical(modelId);
    if (!resolved) return { colors: [], grades: [], series: [] };
    const { col, physicalId, filterChar } = resolved;
    if (!filterChar) {
      // No split for this model — every distinct value in the physical file applies.
      const grades = new Set();
      const transmissions = new Set();
      for (let i = 0; i < col.n; i++) {
        const mc = col.dict.mc[col.mci[i]] || '';
        const g = this._decodeGrade(physicalId, mc);
        if (g) grades.add(g);
        const t = this._decodeTransmission(physicalId, mc);
        if (t) transmissions.add(t);
      }
      return {
        colors: col.dict.c.slice().sort(),
        grades: [...grades].sort(),
        series: Object.keys(col.ranges).map(b => col.dict.b[b] || '0').sort(),
        transmissions: [...transmissions].sort()
      };
    }
    // Grade-split model — scope every value to only the rows that belong to this split.
    const grades = new Set();
    const colors = new Set();
    const series = new Set();
    const transmissions = new Set();
    for (let i = 0; i < col.n; i++) {
      if (!this._rowMatches(col, i, filterChar)) continue;
      const mc = col.dict.mc[col.mci[i]] || '';
      const g = this._decodeGrade(physicalId, mc);
      if (g) grades.add(g);
      colors.add(col.dict.c[col.ci[i]] || '');
      series.add(col.dict.b[col.blk[i]] || '0');
      const t = this._decodeTransmission(physicalId, mc);
      if (t) transmissions.add(t);
    }
    return { colors: [...colors].sort(), grades: [...grades].sort(), series: [...series].sort(), transmissions: [...transmissions].sort() };
  }

};

if (typeof window !== 'undefined') window.JDM_DATABASE = JDM_DATABASE;
