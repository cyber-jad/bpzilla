/**
 * BPZILLA — NISSAN SKYLINE FACTORY RECORD DATABASE
 *
 * Every record is extracted directly from the Nissan FAST microfiche binaries
 * at H:\AR-JP\JP — the VINDAT4/5/6 chassis tables joined against MDLCODE for
 * the 20-character factory model code. Verified byte-for-byte against that
 * source on 2026-08-18 (see the R31/R30 note below for what changed since).
 *
 * 1,284,067 factory records across 34 FAST chassis files, 1987–2007, in
 * five families (the site's own totals; each family is the sum of its
 * loaded files, and the five sum exactly to the figure above):
 *   Skyline R32/R33/R34   543,299     Silvia / 180SX S13-S14   414,207
 *   Stagea C34 / M35      163,895     300ZX Z32 export          97,800
 *   Fairlady Z Z32 (JDM)   64,866
 * Largest single files: S13 165,864, HCR32 144,097, PS13 112,312,
 * S14 81,023, HR32 73,321, ECR33 64,256, HR33 63,726, WGNC34 63,436.
 *
 * (543,299 was this file's headline number back when the archive was
 * Skyline-only. It is still exactly right as the Skyline subtotal, which
 * is why it survived so long in the site copy after the Silvia, Stagea and
 * Z32 families were added — it just stopped being the whole archive.)
 *
 * R31 (HR31, 182,351 records — the single largest chassis) and R30 (DR30,
 * 44,439 records) are intentionally out of scope and not loaded. Both counts
 * were verified against the real FAST source and were not a bug, they were
 * just judged out of scope for this site and dropped by request.
 *
 * Several chassis share a single FAST file across more than one real car, so
 * they're presented here as more than one browsable model even though they
 * come from one physical data file — see `chassisPrefix` / `gradeFilter`
 * below. ER34 covers both the NA 25GT and the turbo 25GT-t; ECR33 covers a
 * dominant grade plus a rare ~1.8% variant whose exact trim name isn't
 * confirmed (see the ECR33_V entry); PS13 and RS13 each hide a Super HICAS
 * sibling (KPS13, KRS13); and WGNC34 carries the Autech 260RS. The reverse
 * also happens once: the six country-specific Z32 export files are merged
 * into two browsable models (see _mergeExportGroups).
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

  // Bucket label for rows whose grade or transmission character exists but has
  // no confirmed meaning. "Not decoded" rather than "not recorded": ER33/ECR33
  // early cars do carry a value here (a literal 'N'), we just can't say what it
  // meant — claiming the plate was blank would be a different, wrong statement.
  // Shared so the breakdowns and countMatching agree on the same string.
  UNDECODED_LABEL: 'Not decoded',
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
    // Displayed here as "GT" / "GT-T" rather than Nissan's own "25GT" /
    // "25GT-t" — this site's naming convention, dropping the displacement
    // prefix for readability, not a claim that "25GT" isn't the real name.
    // They're split into two browsable models here so "GT" isn't hidden
    // inside a combined GT/GT-t entry. `chassisPrefix` points both at the one
    // physical data file (fast_er34.json); `gradeFilter` is the character
    // that selects which rows belong to each.
    'ER34_GT': {
      id: 'ER34_GT', chassisPrefix: 'ER34', gradeFilter: 'E',
      generation: 'R34 (10th Gen)',
      name: 'Skyline GT (ER34)',
      shortName: 'R34 GT',
      chassisCode: 'GF-ER34',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1998 – 2002',
      engine: 'RB25DE NEO 2.5L NA 24-Valve (200 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Tiptronic',
      drivetrain: 'RWD + Helical LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The naturally aspirated half of the ER34 chassis code — same body, same chassis, RB25DE instead of the turbo RB25DET. Nissan\'s own trim name is "25GT"; shown here simply as "GT."'
    },
    'ER34_GTT': {
      id: 'ER34_GTT', chassisPrefix: 'ER34', gradeFilter: 'T',
      generation: 'R34 (10th Gen)',
      name: 'Skyline GT-T (ER34)',
      shortName: 'R34 GT-T',
      chassisCode: 'GF-ER34',
      bodyStyle: '2-Door Coupe & 4-Door Sedan',
      years: '1998 – 2002',
      engine: 'RB25DET NEO 2.5L Turbo 24-Valve (280 PS)',
      transmission: '5-Speed Manual (FS5W71C) / 4-Speed Tiptronic',
      drivetrain: 'RWD + Helical LSD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The turbocharged half of the ER34 chassis code — the iconic R34 GT-T, RB25DET NEO. Nissan\'s own trim name is "25GT-t"; shown here simply as "GT-T."'
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
    // `chassisStamp` is the prefix this car actually wears, as distinct from
    // `chassisPrefix`, which names the physical FAST file the rows live in.
    // The two differ only here, and the data forces the distinction: PS13 and
    // KPS13 serials collide on 12,185 of KPS13's 12,197 records, so the two are
    // running *separate* numbering sequences and cannot share a printed prefix
    // without inventing thousands of duplicate chassis numbers. (Contrast the
    // other splits — ER34 GT/GT-t, RS13/KRS13, WGNC34/260RS, ECR33/ECR33_V —
    // where serials are perfectly disjoint, proving one shared sequence, and
    // where sharing the printed prefix is therefore correct.) Matches the
    // chassisCode below, which was already recorded as E-KPS13.
    'KPS13': {
      id: 'KPS13', chassisPrefix: 'PS13', chassisStamp: 'KPS13',
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
    // A K-flagged Super HiCAS (4WS) minority lives inside this physical file
    // too — not as a leading-character prefix like KPS13/PS13, but as an
    // embedded 'K' at model-code position 6, confirmed against
    // s-chassis-archive.com's published RS13/KRS13 totals (7,262 records
    // here vs. their 7,271 — same tier of variance as every other
    // cross-checked total in this archive). See KRS13 below.
    'RS13': {
      id: 'RS13', chassisPrefix: 'RS13',
      gradeFilter: '6:!K',
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
    'KRS13': {
      id: 'KRS13', chassisPrefix: 'RS13',
      gradeFilter: '6:K',
      generation: 'S13 (Silvia)',
      name: 'Nissan 180SX Super HICAS (KRS13)',
      shortName: '180SX Super HICAS',
      chassisCode: 'E-KRS13',
      bodyStyle: '3-Door Hatchback',
      years: '1989 – 1991',
      engine: 'CA18DET 1.8L Turbo',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The Super HICAS (rear-wheel steering) counterpart to RS13 — same relationship KPS13 has to PS13, one physical file apart. Split out rather than left folded into RS13\'s count.'
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
    // H:\AR-JP\JP. These two models are a genuinely different source:
    // H:\NISSAN\{US,CA,EL,ER}, Nissan's export-destination FAST archive,
    // which uses real 17-character NHTSA-style VINs instead of the JDM
    // chassis+serial scheme. Originally four separate physical sources per
    // body style (US/Canada/"EL"/"ER" — six models total), now merged by
    // _mergeExportGroups into one Z32_EXPORT (2-seat) and one GZ32_EXPORT
    // (2+2) model — Z32 was the only chassis in this archive broken out by
    // destination country in the model picker, and it read as an
    // inconsistency next to every other model here. The merge is additive
    // only: US and CA VINs were independently verified against the
    // standard NHTSA check-digit algorithm — 89,194/89,195 (US) and
    // 2,848/2,848 (CA) pass, a single US anomaly is unresolved and left
    // as-is rather than corrected. EL and ER's VINs do NOT pass check-digit
    // validation (their reconstructed prefix is a shared literal, not a
    // real per-vehicle WMI/VDS) — they're real Nissan FAST records with a
    // genuine 300ZX chassis code, just not confirmed public VINs. Every
    // record still carries its own real market and confirmation status
    // (see `rowSource` / `sourceInfo` on the merged column, and how
    // _materialize reads them) — nothing about which country a given VIN
    // belongs to is lost, it just no longer forces its own model entry.
    //
    // What's NOT available for either of these, unlike the JDM records:
    // no confirmed factory option/model code (Factory Build Code reads "—"),
    // no turbo-vs-NA distinction (export FAST tags only Z32/GZ32 = seat
    // count, not engine), no T-top/slicktop split, and EL/ER records have
    // no confirmed per-vehicle build year at all.
    //
    // "EL" and "ER" are Nissan's own literal internal destination codes
    // (confirmed via H:\NISSAN\FASTPRG\WIN\*\NSFASTKY.INI). What they stand
    // for is NOT confirmed anywhere in the source data — "Europe LHD" /
    // "Europe RHD" is an external inference from matching third-party Nissan
    // parts-catalog listings, corroborated but not internally verified, so
    // it's presented here as inferred, not fact.
    'Z32_EXPORT': {
      id: 'Z32_EXPORT', chassisPrefix: 'Z32_EXPORT',
      generation: 'Z32 Export',
      name: 'Nissan 300ZX 2-Seat — Export Markets (Z32)',
      shortName: '300ZX 2-Seat (Export)',
      chassisCode: 'Z32',
      bodyStyle: '2-Door Coupe (2-seat)',
      years: '1990 – 1996',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'United States & Canada',
      badgeClass: 'badge-nissan',
      description: 'US and Canadian-market 300ZX 2-seat coupes, combined into one entry. VINs reconstructed from the Nissan FAST export microfiche and independently validated against the NHTSA VIN check-digit algorithm — 89,194/89,195 (US) and 2,848/2,848 (Canada) pass; one unresolved US anomaly. Each record still reports its own real market. No confirmed factory option code, turbo/NA split, or roof-type split for this dataset.'
    },
    'GZ32_EXPORT': {
      id: 'GZ32_EXPORT', chassisPrefix: 'GZ32_EXPORT',
      generation: 'Z32 Export',
      name: 'Nissan 300ZX 2+2 — Export Markets (GZ32)',
      shortName: '300ZX 2+2 (Export)',
      chassisCode: 'GZ32',
      bodyStyle: '2-Door Coupe (2+2 seat)',
      years: '1990 – 1996 for US/Canada records; not decoded for "EL"/"ER" records',
      engine: 'VG30DE / VG30DETT V6 (naturally aspirated or twin-turbo — not distinguished in this export dataset)',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      destination: 'United States, Canada, and Nissan FAST destination codes "EL" / "ER" (externally inferred as Europe LHD/RHD, not confirmed)',
      badgeClass: 'badge-nissan',
      description: 'All four 300ZX 2+2 export sources combined into one entry. US (30,213) and Canadian (1,055) VINs independently pass NHTSA check-digit validation; "EL" (4,209) and "ER" (1,548) records are genuine Nissan FAST entries under those destination codes but do not pass check-digit validation and carry no per-vehicle build year. Each record still reports its own real market and validation status — nothing is blended together. T-top only, like every 2+2 Z32.'
    }
  },

  // ---- Which browsable models are "Nissan Legends" (not a Skyline) --------
  // Driven off the "NISSAN LEGENDS" section markers above rather than
  // hand-tagging every entry, so a new Legends model only has to be added
  // once, here, to be picked up everywhere this distinction matters (the
  // separate VIN browser tab, its own model strip, etc).
  _legendModelIds: [
    'S13', 'PS13', 'KPS13', 'KS13', 'RS13', 'KRS13', 'S14', 'CS14',
    'WGC34', 'WHC34', 'WGNC34', 'WGNC34_260RS', 'NM35', 'HM35', 'PM35', 'PNM35',
    'Z32', 'GZ32', 'CZ32', 'HZ32', 'GCZ32',
    'Z32_EXPORT', 'GZ32_EXPORT'
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

  // Z32 was the only chassis in this archive broken out by destination
  // country in the model picker (6 separate US/Canada/EL/ER entries on top
  // of the 5 real JDM body-style entries) — inconsistent with every other
  // model here, which splits by real trim/body/grade, never by market.
  // Collapses each pair/group of country-specific physical files into one
  // browsable model per body style, decoding rows back to plain strings
  // and re-encoding into a fresh shared dictionary so the merge is a
  // straight concatenation, not index surgery. Per-record country and
  // NHTSA check-digit status are NOT blended away in the process — each
  // merged row keeps a `rowSource` index into `sourceInfo`
  // ({destination, confirmed}), and _materialize reads that instead of the
  // single-source `exportInfo` it uses for everything else, so a US VIN
  // still reports itself as US-validated and an "EL" record still reports
  // itself as unconfirmed, same as before the merge.
  _mergeExportGroups: function() {
    const groups = [
      { newId: 'Z32_EXPORT', sources: [
        { id: 'Z32_US', destination: 'United States' },
        { id: 'Z32_CA', destination: 'Canada' }
      ]},
      { newId: 'GZ32_EXPORT', sources: [
        { id: 'GZ32_US', destination: 'United States' },
        { id: 'GZ32_CA', destination: 'Canada' },
        { id: 'GZ32_EL', destination: 'Nissan FAST destination code "EL" — externally inferred as Europe (left-hand-drive) from third-party Nissan parts-catalog listings, not confirmed inside this dataset' },
        { id: 'GZ32_ER', destination: 'Nissan FAST destination code "ER" — externally inferred as Europe (right-hand-drive) from third-party Nissan parts-catalog listings, not confirmed inside this dataset' }
      ]}
    ];

    groups.forEach(({ newId, sources }) => {
      const present = sources.filter(s => this._cols[s.id]);
      if (!present.length) return;

      const rows = [];
      present.forEach(({ id: srcId, destination }) => {
        const col = this._cols[srcId];
        const info = col.exportInfo || {};
        const confirmed = info.vinConfirmedTotal > 0 && info.vinConfirmedCount === info.vinConfirmedTotal;
        for (let i = 0; i < col.n; i++) {
          rows.push({
            blkStr: col.dict.b[col.blk[i]] || '0',
            ser: col.ser[i],
            dateStr: col.dict.d[col.di[i]] || '',
            // Recombine trim + paint so the merged dictionary is built from the
            // same raw field shape the per-file loader saw, then split once at
            // the end. Source columns are already normalised by this point.
            colorStr: (col.dict.ctr ? col.dict.ctr[col.ci[i]] || '' : '') +
                      (col.dict.c[col.ci[i]] || ''),
            interiorStr: col.dict.t[col.ti[i]] || '',
            mcStr: col.dict.mc[col.mci[i]] || '',
            vin: col.vin ? col.vin[i] : undefined,
            srcId, destination, confirmed
          });
        }
      });

      // Keep the (block, serial)-sorted invariant the other lookup path
      // (findChassis -> col.ranges -> _bsearch) documents and relies on,
      // even though export models resolve by VIN first and rarely reach it.
      rows.sort((a, b) => (a.blkStr === b.blkStr ? a.ser - b.ser : (a.blkStr < b.blkStr ? -1 : 1)));

      const n = rows.length;
      const bDict = [], dDict = [], cDict = [], tDict = [], mcDict = [];
      const bIdx = new Map(), dIdx = new Map(), cIdx = new Map(), tIdx = new Map(), mcIdx = new Map();
      const getIdx = (map, arr, val) => {
        if (!map.has(val)) { map.set(val, arr.length); arr.push(val); }
        return map.get(val);
      };

      const merged = {
        n,
        blk: new Uint8Array(n),
        ser: new Int32Array(n),
        di:  new Uint16Array(n),
        ci:  new Uint16Array(n),
        ti:  new Uint8Array(n),
        mci: new Uint16Array(n),
        dict: { b: bDict, d: dDict, c: cDict, t: tDict, mc: mcDict },
        ranges: {},
        vin: new Array(n),
        vinIndex: new Map(),
        rowSource: new Uint8Array(n),
        sourceInfo: []
      };
      const sourceInfoIdx = new Map();

      rows.forEach((r, i) => {
        merged.blk[i] = getIdx(bIdx, bDict, r.blkStr);
        merged.ser[i] = r.ser;
        merged.di[i]  = getIdx(dIdx, dDict, r.dateStr);
        merged.ci[i]  = getIdx(cIdx, cDict, r.colorStr);
        merged.ti[i]  = getIdx(tIdx, tDict, r.interiorStr);
        merged.mci[i] = getIdx(mcIdx, mcDict, r.mcStr);
        merged.vin[i] = r.vin;
        if (r.vin) merged.vinIndex.set(r.vin, i);

        if (!sourceInfoIdx.has(r.srcId)) {
          sourceInfoIdx.set(r.srcId, merged.sourceInfo.length);
          merged.sourceInfo.push({ destination: r.destination, confirmed: r.confirmed });
        }
        merged.rowSource[i] = sourceInfoIdx.get(r.srcId);
      });

      for (let i = 0; i < n; i++) {
        const b = merged.blk[i];
        if (!merged.ranges[b]) merged.ranges[b] = [i, i];
        merged.ranges[b][1] = i;
      }

      this._splitColorDict(merged.dict);
      if (this._ensureSortedByChassis(merged)) this._rebuildRanges(merged);

      this._cols[newId] = merged;
      this._byPrefix[newId] = { length: n };

      present.forEach(({ id: srcId }) => {
        delete this._cols[srcId];
        delete this._byPrefix[srcId];
      });
    });
  },

  // ---- Colour field normalisation ------------------------------------------
  // A Nissan build plate records the body colour as a three-character exterior
  // paint code followed by a single interior trim character. The FAST export
  // carries both in one field, and on the older JDM discs the trim character is
  // often blank — which is why the same paint arrives here as "KH3" on some
  // records and "GKH3" on others.
  //
  // Left alone, that splits one colour into several: an M35 Stagea showed 33
  // "colours" for its 10 real paints, and every per-colour count, percentage
  // and rarity denominator was computed against a fragment of the true total.
  // Nissan's own colour master (the "C" records inside ABBREV on the discs)
  // names paint by the three-character code alone, confirming that the code —
  // not the code-plus-trim — is the colour's identity.
  //
  // Splitting once here, at the dictionary level, fixes every consumer at the
  // same time: `dict.c` becomes the paint code and `dict.ctr` the trim
  // character at the same index, so nothing is discarded and no per-record
  // storage is added.
  _splitColorDict: function(dict) {
    if (!dict || !Array.isArray(dict.c) || dict.ctr) return;
    const paint = new Array(dict.c.length);
    const trim  = new Array(dict.c.length);
    for (let i = 0; i < dict.c.length; i++) {
      const code = dict.c[i] || '';
      const isPrefixed = code.length === 4;
      trim[i]  = isPrefixed ? code[0] : '';
      paint[i] = isPrefixed ? code.slice(1) : code;
    }
    dict.c = paint;
    dict.ctr = trim;
  },

  // ---- Chassis-order invariant ---------------------------------------------
  // findChassis binary-searches col.ser inside the span recorded for a block,
  // which is only valid while rows really are grouped by block and ascending by
  // serial inside each group. Every file satisfied that except PS13, where the
  // 12,197 KPS13 rows sit appended after the block-1 rows as a *second* block-0
  // run — so block 0's recorded span covered the whole file, the serials inside
  // it were not monotonic, and every KPS13 chassis number failed to resolve.
  //
  // Restoring the order here is better than teaching the lookup to cope: the
  // invariant is what the range table, the default row order and the binary
  // search all assume, so one sort keeps the three of them honest at once.
  // Returns true when it had to reorder, so the caller can rebuild the ranges.
  _ensureSortedByChassis: function(col) {
    const blockOf = i => col.dict.b[col.blk[i]] || '0';
    let sorted = true;
    for (let i = 1; i < col.n; i++) {
      const pb = blockOf(i - 1), cb = blockOf(i);
      if (cb < pb || (cb === pb && col.ser[i] < col.ser[i - 1])) { sorted = false; break; }
    }
    if (sorted) return false;

    const order = Array.from({ length: col.n }, (_, i) => i);
    order.sort((a, b) => {
      const ba = blockOf(a), bb = blockOf(b);
      if (ba !== bb) return ba < bb ? -1 : 1;
      return (col.ser[a] - col.ser[b]) || (a - b);
    });

    const permuteTyped = arr => {
      const out = new arr.constructor(col.n);
      for (let i = 0; i < col.n; i++) out[i] = arr[order[i]];
      return out;
    };
    col.blk = permuteTyped(col.blk);
    col.ser = permuteTyped(col.ser);
    col.di  = permuteTyped(col.di);
    col.ci  = permuteTyped(col.ci);
    col.ti  = permuteTyped(col.ti);
    col.mci = permuteTyped(col.mci);
    if (col.rowSource) col.rowSource = permuteTyped(col.rowSource);
    if (col.vin) {
      col.vin = order.map(i => col.vin[i]);
      col.vinIndex = new Map();
      for (let i = 0; i < col.n; i++) if (col.vin[i]) col.vinIndex.set(col.vin[i], i);
    }
    return true;
  },

  _rebuildRanges: function(col) {
    col.ranges = {};
    for (let i = 0; i < col.n; i++) {
      const b = col.blk[i];
      if (!col.ranges[b]) col.ranges[b] = [i, i];
      col.ranges[b][1] = i;
    }
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
      const res = await fetch('/data/paint.json');
      if (res.ok) this._paint = JSON.parse((await res.text()).replace(/^﻿/, ''));
    } catch (e) {
      // paint names are a nicety; codes still display without them
    }

    try {
      const res = await fetch('/data/factoryOptions.json');
      if (res.ok) this._factoryOptions = JSON.parse((await res.text()).replace(/^﻿/, ''));
    } catch (e) {
      // factory option decode is additive; records still display without it
    }

    for (const p of prefixes) {
      const upper = p.toUpperCase();
      try {
        const res = await fetch(`/data/fast_${p}.json`);
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

        this._splitColorDict(col.dict);
        if (this._ensureSortedByChassis(col)) this._rebuildRanges(col);

        this._cols[upper] = col;
        this._byPrefix[upper] = { length: n };
        this._totalRecords += n;
      } catch (e) {
        failed.push(`${upper} (${e.message})`);
      }
    }

    this._mergeExportGroups();

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
    const stamp = (model && model.chassisStamp) || physicalId;
    const block = col.dict.b[col.blk[i]] || '0';
    const serial = col.ser[i];
    const code = col.dict.c[col.ci[i]] || '';
    // The trim character the plate carries alongside the paint code. Kept and
    // shown as the raw factory character: no colour master on the discs names
    // these letters, so decoding one would be a guess.
    const colorTrim = col.dict.ctr ? (col.dict.ctr[col.ci[i]] || '') : '';
    const date = col.dict.d[col.di[i]] || '';
    const name = this._paint[code] || (this.colorNames[code] || {}).name || code;
    const hex = (this.colorNames[code] || {}).hex || this._swatchFor(code, name);

    // Export-market records (US/CA/EL/ER) carry a real reconstructed VIN in
    // col.vin rather than the JDM chassis+block+serial scheme, and US/CA VINs
    // are independently NHTSA check-digit validated while EL/ER are not — see
    // js/database.js models{} "NISSAN LEGENDS — Z32 EXPORT MARKETS" comment.
    if (col.vin) {
      const vin = col.vin[i];
      // A merged export model (col.sourceInfo, built by _mergeExportGroups)
      // has no single uniform market/confirmation status — look it up per
      // record instead of falling back to a whole-column exportInfo.
      let marketName, confirmed;
      if (col.sourceInfo) {
        const src = col.sourceInfo[col.rowSource[i]] || {};
        marketName = src.destination || 'export market';
        confirmed = !!src.confirmed;
      } else {
        const info = col.exportInfo || {};
        marketName = (model || {}).destination || info.region || 'export market';
        confirmed = info.vinConfirmedTotal > 0 && info.vinConfirmedCount === info.vinConfirmedTotal;
      }
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
        colorTrimCode: colorTrim,
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
      // What's actually stamped on the car, never the browsable model id — an
      // ER34_GT and an ER34_GTT both read "ER34-######" because they share one
      // numbering sequence. That is usually the physical file's prefix, but not
      // always: KPS13 runs its own sequence inside the PS13 file and carries
      // its own stamp, so it must not borrow PS13's (see the KPS13 entry).
      chassisNumber: `${stamp}${block}-${String(serial).padStart(6, '0')}`,
      plateNumber: `${stamp}-${String(serial).padStart(6, '0')}`,
      modelId: modelId,
      seriesBlock: block,
      modelCode: col.dict.mc[col.mci[i]] || '',
      modelName: model ? model.name : modelId,
      series: this._decodeSeries(physicalId, block, date, serial),
      grade: this._decodeGrade(physicalId, col.dict.mc[col.mci[i]] || '', date),
      options: this._decodeOptions(physicalId, col.dict.mc[col.mci[i]] || '', date),
      buildDate: date,
      colorCode: code,
      colorTrimCode: colorTrim,
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

  // Stamped-prefix -> { physicalId, filters } lookup, built once on first use.
  // `filters` is null when the whole column wears one stamp (the normal case,
  // including grade splits like ER34 GT/GT-t that share a serial sequence), and
  // is the list of that stamp's row filters when a single file holds more than
  // one stamp — today only PS13/KPS13.
  _chassisStampIndex: null,
  _stampIndex: function() {
    if (this._chassisStampIndex) return this._chassisStampIndex;
    const byStamp = {};
    const stampsPerCol = {};
    for (const key of Object.keys(this.models)) {
      const model = this.models[key];
      const physicalId = model.chassisPrefix || key;
      const stamp = model.chassisStamp || physicalId;
      if (!byStamp[stamp]) byStamp[stamp] = { physicalId, filters: [] };
      byStamp[stamp].filters.push(model.gradeFilter || null);
      (stampsPerCol[physicalId] = stampsPerCol[physicalId] || new Set()).add(stamp);
    }
    for (const stamp of Object.keys(byStamp)) {
      const e = byStamp[stamp];
      if (stampsPerCol[e.physicalId].size < 2) e.filters = null;
    }
    this._chassisStampIndex = byStamp;
    return byStamp;
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

    // The prefix the car is stamped with, which is usually — but not always —
    // the physical file's id. KPS13 shares PS13's file while running its own
    // serial sequence, so it is looked up as "KPS13" and must not return PS13
    // cars that happen to carry the same serial.
    const entry = this._stampIndex()[m[1]];
    if (!entry) return [];
    const { physicalId, filters } = entry;
    const col = this._cols[physicalId];
    if (!col) return [];

    const rowBelongs = i => {
      if (!filters) return true;
      const mc = col.dict.mc[col.mci[i]] || '';
      return filters.some(f => !f || this._matchesFilter(mc, f));
    };

    const search = (block, serial) => {
      const found = [];
      for (const b of Object.keys(col.ranges)) {
        const blockChar = col.dict.b[b] || '0';
        if (block !== undefined && block !== null && block !== '' && blockChar !== block) continue;
        const [lo, hi] = col.ranges[b];
        const i = this._bsearch(col.ser, lo, hi, serial);
        if (i < 0) continue;
        // Two cars in the same block can share a serial where one file holds
        // two numbering sequences, so walk out to both edges of the equal-serial
        // run rather than trusting whichever index the search happened to land
        // on — otherwise the answer depends on where the midpoint fell.
        let lo2 = i, hi2 = i;
        while (lo2 > lo && col.ser[lo2 - 1] === serial) lo2--;
        while (hi2 < hi && col.ser[hi2 + 1] === serial) hi2++;
        for (let k = lo2; k <= hi2; k++) {
          if (!rowBelongs(k)) continue;
          const mc = col.dict.mc[col.mci[k]] || '';
          found.push(this._materialize(this._virtualModelFor(physicalId, mc), k));
        }
      }
      return found;
    };

    const block = m[2];
    const serialStr = m[3];
    const hits = search(block, parseInt(serialStr, 10));
    if (hits.length) return hits;

    // No block digit was given before the dash, and the plain serial found
    // nothing. A real chassis number is sometimes typed with the series
    // block folded into the front of the serial instead of set off before
    // the dash — e.g. "HCR32-259955" for a real Series 2 car whose serial
    // is actually 059955 (259955 = block '2' + serial 59955, with the
    // leading zero a written-out block+serial pairing would need simply
    // dropped). Retry once with the first digit of the serial reinterpreted
    // as the block, rather than silently reporting no match for a real car.
    if (!block && serialStr.length >= 6) {
      return search(serialStr[0], parseInt(serialStr.slice(1), 10));
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
    // S14/CS14 — lower confidence than the S13 family above: no external
    // source with a matching total exists to confirm against exactly, so
    // this rests on real-world grounding instead. Position 4 is 'T' (SR20DET
    // turbo, real K's engine) or 'U' (SR20DE NA, real Q's engine) on every
    // record checked, full 1993-1998 production span on both sides (a
    // standing option, not a running change), independently echoed at
    // position 9 (E/U, matches T/U exactly bar 54 stray records). 62%/38%
    // T/U split is consistent with K's being the better-selling S14 grade,
    // as commonly reported. No further sub-grade (Aero, Aero SE, Aero SE
    // Limited — all real per s-chassis-archive's Japan-market rows) isolable
    // from any position tried, so those stay folded into K's/Q's.
    if (modelId === 'S14' || modelId === 'CS14') {
      const c = mc[4];
      if (c === 'T') return "K's";
      if (c === 'U') return "Q's";
      return '';
    }
    // 180SX (RS13/KRS13) — exact-match confirmed the same way as the S13
    // family: 'D' at position 3 lands on 212 records, matching
    // s-chassis-archive.com's published "Type I" total (212) exactly; 'J'
    // covers the rest ("Type II"). A rare "Type II Leather Selection"
    // sub-grade is real per the same source (286 + 84 records) but wasn't
    // isolable at any position tried, so it stays folded into Type II.
    if (modelId === 'RS13') {
      const c = mc[3];
      if (c === 'D') return 'Type I';
      if (c === 'J') return 'Type II';
      return '';
    }
    return null;
  },
  // Z32 Twin Turbo (CZ32/GCZ32) — RETRACTED, not decoded. An earlier pass
  // through this file labeled the majority character here (60-71% of
  // records, 'S') as "Version S" purely because the letter matched a real
  // JDM grade name. Checking the actual launch date disproved that: real
  // "Version S" cars were introduced in October 1994 (per Nissan press
  // materials and contemporary road tests), but 'S' has been present at
  // full volume since the very start of Z32 production in 1989 — it can't
  // be a grade that didn't exist yet. The minority character, 'A', is the
  // one whose date range actually lines up with something real (it stops
  // dead in Oct 1994, the same month "Version S" launched and the
  // documented Z32 facelift date), but that only tells us 'A' was
  // discontinued then, not what it originally was. No source confirms
  // either letter's real meaning, so both are left undecoded rather than
  // naming one off a coincidence, the mistake made the first time around.
  _decodeZ32TwinTurboGrade: function(modelId, mc) {
    return null;
  },
  // BNR34 sub-grade (V-Spec / V-Spec II / M-Spec / V-Spec II Nür / M-Spec
  // Nür) — EXACT-MATCH CONFIRMED, same tier as the S13 family. Position 14
  // splits the existing 'W' (V-Spec) / 'V' (Standard GT-R) grade at
  // position 4 further: under 'W', 'K' vs 'Z' cleanly follows the real Jan
  // 2000 V-Spec II boundary (K: 1998-06 to 2000-07, Z: 2000-02 onward,
  // same overlap-during-changeover pattern seen elsewhere in this file);
  // '2' -> M-Spec (366 records, introduced 2001); 'V' -> V-Spec II Nür
  // (718 records) and 'M' -> M-Spec Nür (284 records) are both correct to
  // the exact record against gtr-registry.com's own published R34 GT-R
  // production figures (718 V-Spec II Nür, 285 M-Spec Nür, 366 M-Spec,
  // 1,003 total Nür — archived via a 2013-era forum repost of the site's
  // findings, since the site itself is gone). The 1-record M-Spec Nür gap
  // (284 vs 285) is the same order of variance seen on every other
  // cross-checked total in this archive. Under 'V' (Standard GT-R), 'J'
  // vs 'X' is the same Series 1/2 boundary, but Standard GT-R was never
  // given its own Series 2 name the way V-Spec was, so both map to the
  // same "Standard GT-R" label — no invented name for a distinction
  // Nissan itself didn't market.
  _decodeBNR34SubGrade: function(modelId, mc) {
    if (modelId !== 'BNR34') return null;
    const base = mc[4];
    const sub = mc[14];
    if (base === 'W') {
      if (sub === 'V') return 'V-Spec II Nür';
      if (sub === 'M') return 'M-Spec Nür';
      if (sub === '2') return 'M-Spec';
      if (sub === 'Z') return 'V-Spec II';
      if (sub === 'K') return 'V-Spec';
      // N1 homologation letters, added after a real R34 GT-R N1 build
      // plate ("GGJPRWYR34ZDAA--L--") surfaced showing 'L' at this slot
      // labeled "GT-R N1 specification": 'L' -> V-Spec N1 (37 records vs
      // gtr-registry's "38 known V-Spec N1"), '1' -> V-Spec II N1 (18
      // records, exact match to the real 18 V-Spec II N1). Both also show
      // '-' in the glass-package slot (position 13) — consistent with N1
      // cars' documented equipment deletion.
      if (sub === 'L') return 'V-Spec N1';
      if (sub === '1') return 'V-Spec II N1';
      return 'V-Spec';
    }
    if (base === 'V') return 'Standard GT-R';
    return null;
  },
  // BNR32 sub-grade (V-Spec / V-Spec II split, plus N1 and Police flags on
  // top of any grade) — EXACT-MATCH CONFIRMED against the same
  // gtr-registry.com production figures used for BNR34 above. The existing
  // position-6 grade only ever distinguished Standard ('X') from the whole
  // V-Spec family ('B') — this splits 'B' further and adds two option
  // flags found layered on top of *either* base grade:
  //   - Position 9 (or +1 if V-Spec II's own prefix pushes it over — see
  //     below) reading 'P' is a Police-spec car: 13 under Standard, 1
  //     under V-Spec, 14 total — exact match to the real "14 police cars"
  //     figure.
  //   - Positions 9-10 (again +1 under V-Spec II) reading "ZN" followed by
  //     blank padding is the N1 homologation package: 118 under Standard,
  //     64 under V-Spec, 63 under V-Spec II — 245 combined, exact match to
  //     the real total. ("ZN" followed by a further character, not blank,
  //     is a real but different combination — left undecoded rather than
  //     folded into the exact-match N1 figure.)
  //   - Within grade 'B' specifically, an '8' at position 9 marks V-Spec
  //     II rather than V-Spec — first appears Feb 1994, matching the real
  //     Jan 1994 V-Spec II launch almost exactly, and shifts the P/N1
  //     check above one character to the right. 1,306 V-Spec II (exact)
  //     and 1,395 V-Spec (real: 1,396, same 1-record variance seen
  //     throughout this archive) once N1/Police are pulled out.
  _decodeBNR32SubGrade: function(modelId, mc) {
    if (modelId !== 'BNR32') return null;
    const base = mc[6];
    if (base !== 'X' && base !== 'B') return null;
    const isVSpecII = (base === 'B' && mc[9] === '8');
    const off = isVSpecII ? 1 : 0;
    const c1 = mc[9 + off], c2 = mc[10 + off], c3 = mc[11 + off];
    const isN1 = (c1 === 'Z' && c2 === 'N' && (c3 === ' ' || c3 === undefined));
    const isPolice = (c1 === 'P');
    if (base === 'X') {
      if (isN1) return 'GT-R N1';
      if (isPolice) return 'Standard GT-R (Police)';
      return 'Standard GT-R';
    }
    const specName = isVSpecII ? 'V-Spec II' : 'V-Spec';
    if (isN1) return specName + ' N1';
    if (isPolice) return specName + ' (Police)';
    return specName;
  },
  // BCNR33 (R33 GT-R) — same exact-match tier, same gtr-registry.com
  // figures. Position 12 reading 'P' under grade 'Q' (Standard GT-R) is
  // the 416 Autech-converted GT-Rs — exact match, and consistent with the
  // real fact that all but one shared the same model code. Position 14
  // carries the N1 flag under grade 'W' (V-Spec), but with a different
  // letter per series rather than one constant character: 'C' in Series 1
  // (55 records, real: 56), 'N' in Series 2 (21, exact). Series 3's letter,
  // 'R', is shared with something bigger — 112 total, not 10 — but splits
  // cleanly on date into two real things: a tight run of exactly 102
  // records from Jun-Aug 1996 (a real gap follows, nothing again until
  // Feb 1997), matching the real 102-car "V-Spec LM" Le Mans commemorative
  // exactly, and 10 scattered records from Feb 1997 onward, matching
  // Series 3 V-Spec N1 exactly. 55+21+10 = 86 N1 against a real total of
  // 87. 5 real police cars are documented too, but no position or
  // character combination tried isolates them cleanly — left undecoded.
  _decodeBCNR33SubGrade: function(modelId, mc, date) {
    if (modelId !== 'BCNR33') return null;
    const base = mc[4];
    if (base !== 'Q' && base !== 'W') return null;
    if (base === 'Q') {
      if (mc[12] === 'P') return 'Autech GT-R';
      return 'Standard GT-R';
    }
    if (mc[14] === 'C' || mc[14] === 'N') return 'V-Spec N1';
    if (mc[14] === 'R') {
      if (date && date >= '1996-06' && date <= '1996-08') return 'V-Spec LM';
      return 'V-Spec N1';
    }
    return 'V-Spec';
  },
  _decodeGrade: function(modelId, mc, date) {
    const silvia = this._decodeSilviaGrade(modelId, mc);
    if (silvia !== null) return silvia;
    const z32tt = this._decodeZ32TwinTurboGrade(modelId, mc);
    if (z32tt !== null) return z32tt;
    const bnr34sub = this._decodeBNR34SubGrade(modelId, mc);
    if (bnr34sub !== null) return bnr34sub;
    const bnr32sub = this._decodeBNR32SubGrade(modelId, mc);
    if (bnr32sub !== null) return bnr32sub;
    const bcnr33sub = this._decodeBCNR33SubGrade(modelId, mc, date);
    if (bcnr33sub !== null) return bcnr33sub;
    // WGNC34's 'E'/'F' -> RB25 NEO/Pre-NEO labels do not apply to the
    // 260RS records folded into this same physical file (gradeFilter
    // '12:P') — the 260RS runs an Autech-swapped RB26DETT, not an RB25 at
    // all, so the same letters there (confirmed present: 748 'E', 986 'F')
    // would be a real factual error if labeled the same way. Skip the
    // table lookup for those records; they fall through to the generic
    // fallback below instead.
    const is260RS = (modelId === 'WGNC34' && mc[12] === 'P');
    const pos = this.gradePositions[modelId] || 4;
    if (mc.length <= pos) return '';
    const table = is260RS ? null : this.gradeCodes[modelId];
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
    if (this._noRealGradeSplit.includes(modelId)) return '';
    const layouts = (window.MODEL_DECODER || {}).LAYOUTS;
    if (!layouts || layouts[mc.slice(-3)] !== 'positional') return '';
    const ch = mc[4];
    return (ch && ch !== ' ' && ch !== '-') ? `Grade ${ch}` : '';
  },

  // Checked every "positional" model at this position: these five show a
  // single constant character across 100% of records, zero exceptions —
  // there is no real grade split to report, so the generic "Grade ${ch}"
  // fallback would just be dressing up a non-fact as one. Left out of
  // gradeCodes and suppressed here instead of showing a label that's
  // technically a real character but conveys no actual information
  // (getGradeColorMatrix rows then group by series alone, which is real).
  // ER33 and HR33 are NOT on this list — they have a genuine, sizeable
  // split (both real letters present at meaningful volume, full production
  // span) — an attempt to name it as "Type G" was checked against real
  // production numbers and rejected: the real "Type G" is a rare ~850-unit
  // HICAS-less GTS25-t variant, but this letter is the 65-100% majority on
  // three different chassis — wrong scale entirely, so it stays an honest
  // unnamed "Grade E"/"Grade G" rather than a wrong name.
  _noRealGradeSplit: ['ENR33', 'ENR34', 'HR34', 'HM35', 'PM35'],

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
    'ER34':   { 'T': 'GT-T (Turbo)', 'E': 'GT (NA)' },
    // Same idea for ECR33's two grades — see the ECR33_V model entry for
    // what's known (and not known) about what 'V' represents.
    'ECR33':  { 'T': 'GTS25-t', 'V': 'GTS25-t (Type V)' },
    // Stagea WGC34/WHC34 — LOW CONFIDENCE, same tier as S14's K's/Q's. Real
    // Nissan literature references an "E-WGC34 X" chassis suffix, matching
    // the dominant letter here exactly, so 'X' is labeled on that basis.
    // 'E' and 'F' are a genuine running change, not noise ('F' spans Mar
    // 1996-Jul 1998, 'E' Feb 1997 onward) that closely brackets Nissan's
    // documented WC34 "Series 1.5" running change of August 1997, which
    // replaced the RB25DE/RB20E engines with RB25DE NEO/RB20DE NEO — real
    // old-spec inventory commonly keeps shipping alongside new-spec for
    // months after a running change, which would explain 'E' starting
    // ~6 months before the official date and 'F' persisting ~11 months
    // after it. No external production-total source exists for Stagea to
    // verify this exactly (unlike the S13 family), so it's a plausible
    // reading of real Nissan engine history, not a confirmed decode.
    'WGC34': { 'X': 'Stagea X', 'E': 'RB25 NEO', 'F': 'RB25 (Pre-NEO)' },
    'WHC34': { 'X': 'Stagea X', 'E': 'RB20 NEO', 'F': 'RB20 (Pre-NEO)' },
    // Same position, same three letters, same 'F' cutoff to the exact
    // month (Jul 1998) as WGC34/WHC34 above — strong corroboration this is
    // the same platform-wide RB25 NEO running change reaching the 4WD "RS
    // FOUR" chassis too, not a coincidence. Still the same low-confidence
    // tier: no production-total source exists to verify it exactly.
    'WGNC34': { 'X': 'Stagea X', 'E': 'RB25 NEO', 'F': 'RB25 (Pre-NEO)' }
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

  // ---- Factory option decode (build-plate trailing positions) --------------
  // The plate's MODEL string carries one extra leading character (body
  // style) that the FAST mc drops, so published per-position plate decodes
  // map onto this data at exactly -1 — an alignment confirmed against real
  // photographed build plates for BNR32/BCNR33/BNR34/ER34. Three independent
  // sources agree on these fields: (1) real plate photos + published
  // per-position decodes, (2) Nissan's own option-code glossary shipped
  // inside the FAST source itself (H:\AR-JP\JP\SPECDSC.AA1 — e.g.
  // "COLD2R34: F/COLD AREA", "COAT3R34: F/SUPER FINE HARD COATING",
  // "GLSSWR34: F/PRIVACY GLASS"), and (3) this archive's own distributions.
  //
  // Position 10 (climate) is a strict two-character field — 'D' or 'Z',
  // nothing else — on every positional-layout chassis checked (all R33s,
  // all R34s, S14, CS14, all three C34 Stageas). 'Z' = the cold-weather
  // "Cold Area" spec, corroborated by the take-rate pattern: the AWD
  // 25GT-Four shows 39% (R34) / 37% (R33) cold-weather share versus 1.4%
  // on the cheapest RWD 20GT — exactly the snowy-region skew a real cold
  // package would have, and nothing a random flag would produce.
  //
  // Positions 12-16 (the five-character factory option block; build-plate
  // positions 13-17) are decoded from Nissan's OWN per-letter definition
  // table: the FASTOP file inside the FAST source (H:\AR-JP\JP\FASTOP),
  // extracted and translated by extract_fastop.ps1 into
  // data/factoryOptions.json. Each entry carries the date-validity window
  // Nissan assigned it, because letters were genuinely redefined over time
  // (R33 has five windows) — a 1994 'K' and a 1996 'K' mean different
  // equipment, and the lookup matches on the car's build date. FASTOP only
  // exists for the positional-layout chassis this archive serves (R33, R34,
  // S14, WC34 Stagea); a letter with no FASTOP definition stays silent
  // rather than guessed. The earlier hand-built R34 tables (from real plate
  // photos) were checked against FASTOP and matched — FASTOP is simply the
  // same information from the source itself, with fuller letter coverage
  // and correct windows, so it replaced them.
  _optionalEquipmentChassis: [
    'BCNR33', 'ECR33', 'ER33', 'ENR33', 'HR33',
    'BNR34', 'ER34', 'ENR34', 'HR34',
    'S14', 'CS14', 'WGC34', 'WHC34', 'WGNC34'
  ],
  _factoryOptions: null,   // loaded from data/factoryOptions.json in loadFastData
  _factoryOptionsGen: { 'R33': 'R33', 'R34': 'R34', 'S14': 'S14', 'WC3': 'WC34' },

  // ---- R32 build plate ------------------------------------------------------
  // The R32 predates FASTOP, so there is no option table for it anywhere on the
  // discs — searched, twice, including for the exact equipment wording. What
  // follows is built from this archive's own distributions first, with outside
  // sources used only to name what the data had already isolated.
  //
  // The R32's tail is not the fixed five-slot block the R33/R34 use. It is
  // variable length (2 to 5 characters, no padding, no internal blanks across
  // all 58 distinct BNR32 codes), but it is still positional by absolute index —
  // shorter codes simply stop early. Plate position = mc index + 2, the same
  // one-character body-style offset documented at the top of this file.
  //
  // What the data itself settles:
  //
  //   mc[9] is a SERIES marker, not equipment. It maps almost one-to-one onto
  //   the series blocks — L to blocks 0/1, A to block 2, 7 to block 3 — and its
  //   values partition the production run in time (L ends 1991-07, 7 begins
  //   1993-01) rather than scattering across it the way an option would. Widely
  //   circulated tables call this position "Sunroof" or "Projector Headlamps";
  //   neither survives that test, so neither is used here.
  //
  //   mc[10] carries a baseline letter per series with a small variant against
  //   it — M vs T in Series 1 (16,364 vs 1,018), A vs Z in Series 3 (13,077 vs
  //   980). The variant is where the real option sits, and it is Z, which is
  //   Cold Weather in every Nissan scheme and sits at exactly the mc position 10
  //   this file already reads cold-weather from on the R33/R34/S14/C34 chassis.
  //   T is M plus that same Z.
  //
  // Anything below marked reported: true is named from outside sources (owner
  // documentation supplied for this work, corroborated by published R32 plate
  // guides) and has NOT been independently confirmed against this archive. It
  // is shown to the reader flagged as such rather than presented as fact.
  //
  // BNR32 ONLY. The same letters mean different things on the other R32
  // chassis — see the note in _decodeR32Plate — so this table is not applied
  // to them, and their plate characters are shown positioned but unnamed.
  _r32Plate: {
    // mc[5..8] — the fixed block before the options. Published R32 breakdowns
    // put body / grade / gearbox / induction here, and this archive confirms
    // all four independently: mc[5] is R on every one of the 43,895 records
    // (BNR32 was coupe-only), mc[7] is F on every one (manual-only), mc[8] is
    // S on every one (RB26DETT), and mc[6] splits X/B exactly along the V-Spec
    // line that _decodeBNR32SubGrade arrives at from the opposite direction —
    // X covers Standard/N1/Police, B covers V-Spec, V-Spec II and their N1s,
    // with no exceptions in either set.
    5: {
      R: { text: '2-door coupe', verified: true }
    },
    6: {
      X: { text: 'GT-R (standard, non V-Spec)', verified: true },
      B: { text: 'GT-R V-Spec family', verified: true }
    },
    7: {
      F: { text: '5-speed manual', verified: true }
    },
    8: {
      S: { text: 'RB26DETT twin-turbo, intercooled', verified: true }
    },
    // mc[9] — series / specification marker
    // Only the four letters whose series mapping this archive can actually
    // demonstrate. Z, N, M, T and P also appear here, and outside charts offer
    // names for them, but those names contradict decodes this file already
    // verifies — labelling a lone N "N1 specification" puts the plate at odds
    // with _decodeBNR32SubGrade, which identifies N1 from "ZN" followed by a
    // blank and matches the published 245-car total exactly. They stay unnamed.
    9: {
      L: { text: 'Series 1 specification', verified: true },
      A: { text: 'Series 2 specification', verified: true },
      7: { text: 'Series 3 specification, 16-inch wheels', reported: true },
      8: { text: 'V-Spec II tyre specification (245/45R17)', verified: true }
    },
    // mc[10] — factory equipment
    10: {
      A: { text: 'Standard equipment', verified: true },
      M: { text: 'Full Auto A/C + Active Sound System', reported: true },
      Z: { text: 'Cold Weather Package (Cold Area spec)', verified: true },
      T: { text: 'Full Auto A/C + Active Sound System + Cold Weather Package', verified: true },
      P: { text: 'Full Auto A/C', reported: true },
      R: { text: 'Early Series 1 equipment group', verified: true }
    },
    // mc[11]/mc[12] — trailing pair. "ZG" is the one this archive can speak to:
    // 16,428 records carry it as a pair and never apart.
    11: {
      Z: { text: 'Rear wiper, GT-R specification', reported: true, pairsWith: 12 },
      A: { text: 'Rear wiper and rear spoiler', reported: true }
    },
    12: {
      G: { text: 'GT-R specification', reported: true, partOfPair: true },
      A: { text: 'Standard GT-R trim level', reported: true }
    }
  },
  // BNR32 alone. The other R32 chassis write a shorter chassis prefix into the
  // model code — "CR32GAELQKB" and "R32GAEAA" against BNR32's "BNR32RXFSLMZG" —
  // so the same mc index is a different plate position on each of them, and
  // labelling one "(11K)" off BNR32's offset would be a wrong number stated
  // confidently. Until each prefix length is pinned down and checked, they
  // report no plate breakdown rather than a misnumbered one.
  // All five R32 chassis. Anchoring on the literal "R32" inside the model code
  // and splitting the two prefix variants aligns the whole family, so they all
  // get their gearbox read and their option characters shown in order. Only
  // BNR32 has names for those characters — see _r32Plate.
  _r32Chassis: ['BNR32', 'HCR32', 'HNR32', 'HR32', 'FR32'],
  // "1995-07" -> 9507; 2000s get +10000 so 2000-08 sorts after 1998-05 the
  // same way FASTOP's own YYMM windows do (9805 vs 0008 -> 9805 vs 10008).
  _yymm: function(date) {
    if (!date || date.length < 7) return null;
    const yr = parseInt(date.slice(0, 4), 10);
    const mm = parseInt(date.slice(5, 7), 10);
    if (isNaN(yr) || isNaN(mm)) return null;
    return (yr % 100) * 100 + mm + (yr >= 2000 ? 10000 : 0);
  },
  // Plate position for a given mc index. The plate's MODEL string carries one
  // extra leading body-style character that the FAST export drops, so a
  // published per-position decode lines up with this data at exactly -1 — the
  // alignment confirmed against photographed plates and against Nissan's own
  // numbered R33 diagram, where the option block is positions 14-18 and lands
  // on mc 12-16.
  platePos: function(mcIndex) { return mcIndex + 2; },

  // The R32 reads from its own table (see _r32Plate) because its layout is
  // chassis-led and variable length, not the fixed five-slot block the later
  // cars use.
  // Where each field sits in an R32 model code.
  //
  // The R32 export writes a variable-length chassis prefix — "BNR32RXFSLMZG",
  // "RCR32RGAESA", "CR32GAELQKB", "R32GAEAA" — so no fixed index works across
  // the family. But every code contains the literal "R32", which anchors it,
  // and each chassis appears in two variants: one carrying the body-style
  // character and one omitting it.
  //
  // Split on that and the layout is identical everywhere: body (where present),
  // grade, gearbox, induction, then the options. The gearbox slot is the
  // check — it holds F or A and nothing else on every chassis once the
  // variants are separated, which is what confirms the whole alignment.
  _r32Layout: function(mc) {
    const body = String(mc || '').replace(/\s+R32\s*$/, '');
    const anchor = body.indexOf('R32');
    if (anchor < 0) return null;
    // "R32" is followed by the body character on one variant and by the grade
    // on the other; R marks the body character.
    const hasBody = body[anchor + 3] === 'R';
    const grade = anchor + (hasBody ? 4 : 3);
    return {
      body: hasBody ? anchor + 3 : -1,
      grade,
      gearbox: grade + 1,
      induction: grade + 2,
      optionsFrom: grade + 3,
      end: body.length
    };
  },

  _r32Gearbox: { F: '5-speed manual', A: '4-speed automatic', E: '5-speed automatic' },

  _decodeR32Plate: function(modelId, mc) {
    const opts = [];
    if (!mc) return opts;
    const L = this._r32Layout(mc);
    if (!L) return opts;

    // The gearbox slot holds F or A on every R32 chassis once the two prefix
    // variants are separated, which is what confirms the alignment — so it is
    // read for the whole family, not just the GT-R.
    const gearCh = mc[L.gearbox];
    if (this._r32Gearbox[gearCh]) {
      opts.push({ pos: L.gearbox, platePos: null, field: 'Gearbox', char: gearCh,
                  text: this._r32Gearbox[gearCh], verified: true });
    }

    // Everything past the induction character. BNR32 has a table for these and
    // a settled plate numbering; the other R32 chassis do not, and their codes
    // omit a different number of leading characters, so numbering their slots
    // off BNR32's offsets would be a wrong number stated confidently. They get
    // their characters shown in order, unnumbered and unnamed, which beats the
    // nothing at all they showed before.
    const isGtr = modelId === 'BNR32';
    const table = isGtr ? this._r32Plate : {};
    for (let idx = L.optionsFrom; idx < L.end; idx++) {
      const ch = mc[idx];
      if (!ch || ch === '-' || ch === ' ') continue;
      const def = (table[idx] || {})[ch];
      if (!def) {
        // A character that's really there but has no confirmed meaning is
        // shown as itself rather than dropped, same as everywhere else here.
        opts.push({ pos: idx, platePos: isGtr ? this.platePos(idx) : null,
                    char: ch, text: null, undecoded: true });
        continue;
      }
      if (def.partOfPair) continue;          // already reported by its partner
      opts.push({ pos: idx, platePos: this.platePos(idx), char: ch,
                  text: def.text, verified: !!def.verified, reported: !!def.reported });
    }
    return opts;
  },

  _decodeOptions: function(modelId, mc, date) {
    const opts = [];
    if (!mc) return opts;
    if (this._r32Chassis.includes(modelId)) return this._decodeR32Plate(modelId, mc);
    if (this.layoutOf(mc) !== 'positional') return opts;
    if (this._optionalEquipmentChassis.includes(modelId)) {
      if (mc[10] === 'Z') opts.push({ pos: 10, platePos: this.platePos(10), char: 'Z',
        text: 'Cold Weather Package (Cold Area spec)', verified: true });
    }
    const table = this._factoryOptions && this._factoryOptions[this._factoryOptionsGen[mc.slice(-3)]];
    if (!table) return opts;
    const d = this._yymm(date);
    for (let p = 0; p < 5; p++) {
      const ch = mc[12 + p];
      if (!ch || ch === '-' || ch === ' ') continue;
      // exact window match on build date first; for cars built after the
      // last window FASTOP was maintained to (table upkeep stopped before
      // production did on every chassis here), fall back to the latest
      // definition of that letter rather than dropping it.
      let hit = null, latest = null, earliest = null;
      for (const e of table) {
        if (e.pos !== p || e.char !== ch) continue;
        const from = e.from < 8000 ? e.from + 10000 : e.from;
        const to = e.to < 8000 ? e.to + 10000 : e.to;
        if (d !== null && from <= d && d <= to) { hit = e; break; }
        if (!latest || to > (latest._to || 0)) { latest = e; latest._to = to; }
        if (!earliest || from < (earliest._from || 99999)) { earliest = e; earliest._from = from; }
      }
      // Outside every window, fall back to the nearest one in that direction.
      // The windows record when FASTOP was maintained, not when the car was
      // built, and they are narrower than production at both ends: the R33
      // table starts 9308 while R33 records start 1993-02, so every car built
      // Feb-Jul 1993 decoded to nothing at all. The tail end was already
      // handled; this is the same argument applied to the head.
      const use = hit
        || (d !== null && latest && d > latest._to ? latest : null)
        || (d !== null && earliest && d < earliest._from ? earliest : null);
      // FASTOP is Nissan's own table, so a hit is as confirmed as this gets.
      // A miss is still shown — the character is genuinely stamped on the car,
      // and "position 15 reads B, meaning unconfirmed" is a more useful and more
      // honest answer than silently omitting the field. Roughly 3% of slots
      // across the R33/R34 chassis land here.
      if (use) opts.push({ pos: 12 + p, platePos: this.platePos(12 + p), char: ch,
                           text: use.text, verified: true });
      else opts.push({ pos: 12 + p, platePos: this.platePos(12 + p), char: ch,
                       text: null, undecoded: true });
    }
    return opts;
  },
  layoutOf: function(mc) {
    const layouts = (window.MODEL_DECODER || {}).LAYOUTS || {};
    return layouts[String(mc || '').slice(-3)] || '';
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
      ['Z32_EXPORT', 'GZ32_EXPORT'].forEach(m => { out[m] = years; });
      return out;
    })()
  },

  // Column-header sorting. Each entry returns the value to order by for one
  // row; 'chassis' is deliberately absent because the store is already held
  // in (block, serial) order, so ascending chassis is the natural order and
  // needs no sort pass at all — see getVirtualPage.
  _sortKeys: {
    buildDate: (col, i) => col.dict.d[col.di[i]] || '',
    color:     (col, i) => col.dict.c[col.ci[i]] || '',
    // Sorting by model has to keep each model's rows internally ordered, or
    // the "All Skyline"/"All Legends" views would shuffle chassis numbers
    // within a model. Serial is padded so it compares as a string alongside
    // the model id.
    model:     (col, i, physicalId) => physicalId + String(col.ser[i]).padStart(7, '0')
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
      transmissionFilter = 'ALL',
      sortField = '',
      sortAsc = true
    } = params;

    // Ascending chassis is the order the rows are already stored in, so it
    // costs nothing; every other column (and descending chassis) needs a
    // real pass. Reversing is done by the comparator rather than by sorting
    // and reversing, so equal keys keep a stable relative order either way.
    const sortKey = sortField && this._sortKeys[sortField]
      ? this._sortKeys[sortField]
      : (sortField === 'chassis' && !sortAsc
          ? (col, i, physicalId) => physicalId + String(col.ser[i]).padStart(7, '0')
          : null);

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
    const exactMatches = [];   // positions in `matches` that matched exactly
    for (const id of ids) {
      const resolved = this._resolvePhysical(id);
      if (!resolved) continue;
      const { col, physicalId, filterChar } = resolved;
      // Search has to build the same identifier the rows display, which is the
      // stamped prefix — the same for both only until a model like KPS13 runs
      // its own numbering inside another chassis's file. Hoisted out of the row
      // loop: every row reached here already belongs to this one model.
      const stamp = (this.models[id] && this.models[id].chassisStamp) || physicalId;
      for (let i = 0; i < col.n; i++) {
        if (!this._rowMatches(col, i, filterChar)) continue;
        if (colorFilter !== 'ALL' && col.dict.c[col.ci[i]] !== colorFilter) continue;
        if (seriesFilter !== 'ALL' && (col.dict.b[col.blk[i]] || '0') !== seriesFilter) continue;
        if (yearFilter !== 'ALL' && (col.dict.d[col.di[i]] || '').slice(0, 4) !== yearFilter) continue;
        if (gradeFilter !== 'ALL') {
          if (this._decodeGrade(physicalId, col.dict.mc[col.mci[i]] || '', col.dict.d[col.di[i]] || '') !== gradeFilter) continue;
        }
        if (transmissionFilter !== 'ALL') {
          if (this._decodeTransmission(physicalId, col.dict.mc[col.mci[i]] || '') !== transmissionFilter) continue;
        }
        if (q) {
          const code = col.dict.c[col.ci[i]] || '';
          const name = (this._paint[code] || '').toUpperCase();
          // Dashes are stripped from both sides before comparing, so the
          // table filter accepts a chassis number typed the way it's stamped
          // ("BNR34-000055"), the fully-qualified FAST key
          // ("BNR340-000055"), or with no dash at all ("BNR34000055") — the
          // last of which previously matched nothing, since every candidate
          // string it was compared against contained a dash.
          const qBare = q.replace(/-/g, '');
          if (col.vin) {
            const vin = col.vin[i].toUpperCase();
            if (!vin.includes(q) && !vin.replace(/-/g, '').includes(qBare) &&
                !code.includes(q) && !name.includes(q)) continue;
          } else {
            const block = col.dict.b[col.blk[i]] || '0';
            const serial = String(col.ser[i]).padStart(6, '0');
            const fastKey = `${stamp}${block}-${serial}`;   // BNR340-000055
            const plate = `${stamp}-${serial}`;             // BNR34-000055
            const mc = (col.dict.mc[col.mci[i]] || '').toUpperCase();
            if (!fastKey.includes(q) && !plate.includes(q) &&
                !fastKey.replace(/-/g, '').includes(qBare) &&
                !plate.replace(/-/g, '').includes(qBare) &&
                !code.includes(q) && !name.includes(q) && !mc.includes(q)) continue;
            // Typing a whole chassis number should land on that car. Substring
            // matching is what makes partial searches useful, but it also means
            // "BNR34-000101" matches BNR34-001010 through -001019, since those
            // strings contain it once the dashes come out. Exact hits are
            // flagged here and, if any exist, everything else is dropped below.
            if (fastKey === q || plate === q ||
                fastKey.replace(/-/g, '') === qBare || plate.replace(/-/g, '') === qBare) {
              exactMatches.push(matches.length);
            }
          }
        }
        // The sort key is captured here rather than looked up later: `col` is
        // already in hand for this row, and after the loop a match is just an
        // (id, index) pair that would need its column resolved all over again.
        matches.push(sortKey ? [id, i, sortKey(col, i, physicalId)] : [id, i]);
      }
    }

    // A query that exactly matched a chassis number answers with those cars
    // only. Two can legitimately survive — the same serial in two series
    // blocks is a real pair of different cars — but the near-misses go.
    const hits = exactMatches.length
      ? exactMatches.map(k => matches[k])
      : matches;

    if (sortKey) {
      const dir = sortAsc ? 1 : -1;
      hits.sort((a, b) => (a[2] < b[2] ? -dir : a[2] > b[2] ? dir : 0));
    }

    const total = hits.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;

    const records = hits.slice(start, start + pageSize)
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
    // A handful of records carry a model code in a different format from the
    // rest of their chassis (S14's 54 "BYARR..." rows, for instance) and no
    // position rule decodes them. They were previously left out of these
    // breakdowns entirely, so the percentages summed to less than 100% and the
    // rows didn't reconcile against the model total. They get their own bucket
    // below instead — undecoded is a fact about the record, not a reason to
    // drop it from the count.
    let ungradedCount = 0;
    let untransmissionedCount = 0;

    for (let i = 0; i < col.n; i++) {
      if (!this._rowMatches(col, i, filterChar)) continue;
      totalCount++;

      const c = col.dict.c[col.ci[i]] || '';
      colorCounts.set(c, (colorCounts.get(c) || 0) + 1);

      const mc = col.dict.mc[col.mci[i]] || '';
      const g = this._decodeGrade(physicalId, mc, col.dict.d[col.di[i]] || '');
      if (g) gradeCounts.set(g, (gradeCounts.get(g) || 0) + 1);
      else ungradedCount++;

      const t = this._decodeTransmission(physicalId, mc);
      if (t) transmissionCounts.set(t, (transmissionCounts.get(t) || 0) + 1);
      else untransmissionedCount++;

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

    // Only worth showing the leftover bucket where the rest of the chassis did
    // decode. A model with no grade rule at all reports an empty breakdown, and
    // a single "Not recorded in code: 144,097" row would be noise, not news.
    const withRemainder = (entries, key, remainder) => {
      const rows = [...entries]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ [key]: value, count, percent: pct(count) }));
      if (rows.length && remainder > 0) {
        rows.push({ [key]: this.UNDECODED_LABEL, count: remainder, percent: pct(remainder) });
      }
      return rows;
    };

    const gradeBreakdown = withRemainder(gradeCounts.entries(), 'grade', ungradedCount);
    const transmissionBreakdown =
      withRemainder(transmissionCounts.entries(), 'transmission', untransmissionedCount);

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

  // ---- Exact combination counts --------------------------------------------
  // How many cars were built to one particular spec — a given grade, in a given
  // paint, with a given set of factory options.
  //
  // This used to be modelled rather than counted: grade share multiplied by
  // colour share multiplied by a table of invented per-option coefficients.
  // For a BNR34 V-Spec II Nür in Bayside Blue that produced "1 of 178" when the
  // factory records hold exactly 119 — a 50% overstatement, printed onto a
  // certificate of authenticity. Every one of those records is loaded in this
  // browser, so the combination is counted directly and the estimate is gone.
  //
  // Grade and options both derive from (model code, date), so both decodes are
  // memoised on that pair; a model's rows only carry a few thousand distinct
  // combinations even when there are a hundred thousand records.
  countMatching: function(modelId, criteria) {
    const { grade = null, colorCode = null, options = [] } = criteria || {};
    const resolved = this._resolvePhysical(modelId);
    if (!resolved || !resolved.col.n) return null;
    const { col, physicalId, filterChar } = resolved;
    const wanted = (options || []).filter(Boolean);

    const gradeCache = new Map();
    const optionCache = new Map();
    let count = 0, total = 0;

    for (let i = 0; i < col.n; i++) {
      if (!this._rowMatches(col, i, filterChar)) continue;
      total++;
      if (colorCode && (col.dict.c[col.ci[i]] || '') !== colorCode) continue;

      const key = col.mci[i] + '|' + col.di[i];
      const mc = col.dict.mc[col.mci[i]] || '';
      const date = col.dict.d[col.di[i]] || '';

      if (grade) {
        let g = gradeCache.get(key);
        if (g === undefined) { g = this._decodeGrade(physicalId, mc, date) || ''; gradeCache.set(key, g); }
        // The breakdowns bucket undecodable rows under a label rather than
        // dropping them, so selecting that bucket has to match them here too.
        if ((g || this.UNDECODED_LABEL) !== grade) continue;
      }
      if (wanted.length) {
        let texts = optionCache.get(key);
        if (texts === undefined) {
          texts = (this._decodeOptions(physicalId, mc, date) || []).map(o => o.text);
          optionCache.set(key, texts);
        }
        if (!wanted.every(w => texts.indexOf(w) !== -1)) continue;
      }
      count++;
    }
    return { count, total };
  },

  // Every factory option this model's records actually decode to, with how many
  // cars carry each. Drives the rarity calculator's option list, so what's on
  // offer is always something the archive can really count rather than a fixed
  // set of checkboxes that may mean nothing for the selected chassis.
  getOptionCatalog: function(modelId) {
    const resolved = this._resolvePhysical(modelId);
    if (!resolved || !resolved.col.n) return [];
    const { col, physicalId, filterChar } = resolved;
    const tally = new Map();
    const cache = new Map();
    for (let i = 0; i < col.n; i++) {
      if (!this._rowMatches(col, i, filterChar)) continue;
      const key = col.mci[i] + '|' + col.di[i];
      let texts = cache.get(key);
      if (texts === undefined) {
        texts = (this._decodeOptions(physicalId,
          col.dict.mc[col.mci[i]] || '', col.dict.d[col.di[i]] || '') || []).map(o => o.text);
        cache.set(key, texts);
      }
      for (const t of texts) tally.set(t, (tally.get(t) || 0) + 1);
    }
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([text, count]) => ({ text, count }));
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
      // Deliberately NOT defaulted to 'Unknown' here — an empty decode means
      // two very different things depending on context, and conflating them
      // was actively misleading. Handled below once we know whether a real
      // series label exists for this record too.
      const grade = this._decodeGrade(physicalId, mc, col.dict.d[col.di[i]] || '');
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
      // grade + series -> "Grade (Series)". Grade alone -> "Grade". Series
      // alone (no grade decoded for this chassis at all) -> just "Series",
      // with no false "Unknown" grade prefix — that word is reserved for
      // genuinely unparseable records, not chassis that simply don't have a
      // decoded grade system. Neither -> the one real "Unknown" case, a
      // record with no grade AND no series to fall back on.
      const rowLabel = grade
        ? (seriesLabel ? `${grade} (${seriesLabel})` : grade)
        : (seriesLabel || 'Unknown');

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
        const g = this._decodeGrade(physicalId, mc, col.dict.d[col.di[i]] || '');
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
      const g = this._decodeGrade(physicalId, mc, col.dict.d[col.di[i]] || '');
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
