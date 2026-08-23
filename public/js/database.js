/**
 * BPZILLA — NISSAN SKYLINE FACTORY RECORD DATABASE
 *
 * Every record is extracted directly from the Nissan FAST microfiche binaries
 * at H:\AR-JP\JP — the VINDAT4/5/6 chassis tables joined against MDLCODE for
 * the 20-character factory model code. Verified byte-for-byte against that
 * source on 2026-08-18 (see the R31/R30 note below for what changed since).
 *
 * 1,396,771 factory records, 1987–2007. Three different counts describe this
 * archive and they are easy to confuse, so all three are spelled out:
 *   44  fast_*.json files exist in public/data
 *   38  of them are fetched (six are out of scope — see the note below)
 *   34  chassis entries after _mergeExportGroups folds the six Z32 export
 *       files into two, which is what `_cols` ends up holding
 *   40  browsable models in models{}
 * "34 chassis" is the post-merge figure this header has always quoted; it read
 * 34 while 38 files were being fetched, which was right under that definition.
 *
 * Five families (the site's own totals; each family is the sum of its
 * loaded files, and the five sum exactly to the figure above):
 *   Skyline R32/R33/R34   560,785     Silvia / 180SX S13-S15   539,912
 *   Stagea C34            133,408     300ZX Z32 export          97,800
 *   Fairlady Z Z32 (JDM)   64,866
 * Largest single files: S13 165,864, HCR32 144,097, PS13 112,312,
 * S14 81,023, HR32 73,321, ECR33 64,256, HR33 63,726, WGNC34 63,436.
 *
 * (543,299 was this file's headline number back when the archive was
 * Skyline-only, and it stayed exactly right as the Skyline subtotal long
 * after the Silvia, Stagea and Z32 families were added — which is why it
 * survived so long in the site copy. It is no longer either figure: adding
 * ECR32 and ER32 below took the Skylines to 560,785.)
 *
 * ECR32 (15,475) and ER32 (2,011) were added on 2026-08-22 — the RB25DE
 * GTS25 cars, present in the FAST source from the start and never extracted,
 * so a real chassis like ECR32-007552 came back "not found". They were pulled
 * with extract_vindat.js, which earns its trust by re-deriving the five R32
 * chassis this file already shipped and reproducing all five exactly: same
 * counts, same dictionaries in the same order, same rows.
 *
 * RPS13 (74,910) and KRPS13 (11,655) followed the same day, found by
 * audit_chassis.js walking the source rather than checking a list. RS13 above
 * is only the first two and a half years of the 180SX; everything from the end
 * of 1990 wears RPS13, and none of it was here. The site held 24% of the
 * 180SX records in the source while presenting RS13 as the 180SX.
 *
 * Two S13 records were recovered at the same time. The shipped fast_s13.json
 * held 165,864 where the source has 165,866 — block 2 serial 7138 (1991-07)
 * and block 6 serial 2182 (1989-05) had been dropped. Nothing was in the
 * shipped file that the re-extract lacked, so it was a clean superset.
 *
 * R31 (HR31, 182,351 records — the single largest chassis), R30 (DR30,
 * 44,439 records) and the M35 Stagea (NM35 25,281, PNM35 1,849, HM35 1,682,
 * PM35 1,675 — 30,487 together) are intentionally out of scope and not
 * loaded. All of these counts were verified against the real FAST source and
 * were not a bug, they were just judged out of scope for this site and
 * dropped by request.
 *
 * Out of scope means UNLOADED, NOT DELETED. Every one of those files is still
 * in public/data, and must stay there: the fast_*.json exports have no
 * extractor in this repo, so re-creating one would mean re-deriving it from
 * the FAST binaries from scratch. Dropping a chassis from the site costs
 * nothing; deleting its file costs the data. To bring one back, add its
 * prefix to `prefixes` in loadFastData and give it an entry in models{}.
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
    // ECR32 and ER32 — the RB25DE cars, added 2026-08-22.
    //
    // Both were in the FAST source all along and neither had ever been
    // extracted, so ECR32-007552 came back "not found" for a car that exists.
    // Everything below is read off Nissan's own legend for the [9108-9411]
    // window (volume 079 front matter, page 2), which is the window that first
    // lists E at all — the [8905-9108] page knows only F, H, R and B:
    //
    //   E = RB25DE            C = スーパーハイキャス付の2WD (Super HICAS, 2WD)
    //   車両仕様 G = GTE, GTS, GTS-T, GTS 25, GTS-4
    //   変速機 Y = オートマチック5速, F = マニュアル5速
    //
    // So ECR32 is the RB25DE with Super HICAS and ER32 the RB25DE without,
    // both the GTS25 grade. That page's own worked example is "K E C R32 R",
    // this exact chassis. Model codes parse straight through it:
    // ECR32RGYELAA = E·C·R32·R(2door)·G(GTS25)·Y(5sp auto)·E(EGI) + L + pack AA.
    //
    // Body styles and the transmission split are counted from the records
    // rather than assumed — see each description.
    'ECR32': {
      id: 'ECR32', chassisPrefix: 'ECR32',
      generation: 'R32 (8th Gen)',
      name: 'Skyline GTS25 (ECR32)',
      shortName: 'R32 GTS25',
      chassisCode: 'E-ECR32',
      bodyStyle: '4-Door Sedan & 2-Door Hardtop',
      years: '1991 – 1993',
      engine: 'RB25DE 2.5L NA DOHC I6',
      transmission: '5-Speed Auto / 5-Speed Manual',
      drivetrain: 'RWD + Super HICAS',
      badgeClass: 'badge-nissan',
      description: 'The 2.5-litre RB25DE Skyline with Super HICAS four-wheel steering, introduced at the August 1991 minor change — volume production starts 1991-07 here, with 33 pre-launch cars from 1990-10. 9,175 of these records are the 4-door sedan and 6,300 the 2-door hardtop; 10,704 carry the 5-speed automatic against 4,771 manuals.'
    },
    'ER32': {
      id: 'ER32', chassisPrefix: 'ER32',
      generation: 'R32 (8th Gen)',
      name: 'Skyline GTS25 (ER32)',
      shortName: 'R32 GTS25 (no HICAS)',
      chassisCode: 'E-ER32',
      bodyStyle: '4-Door Sedan',
      years: '1991 – 1993',
      engine: 'RB25DE 2.5L NA DOHC I6',
      transmission: '5-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The same RB25DE GTS25 without Super HICAS — the suspension character is simply absent from its model code, which is the whole difference from ECR32. Much the rarer of the two at 2,011 records against 15,475, and unusually uniform: every one is a 4-door sedan and every one is the 5-speed automatic.'
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
      years: '1988 – 1990',
      engine: 'CA18DET 1.8L Turbo',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The fixed-headlight hatchback on the S13 platform — sold as the 180SX in Japan, 200SX in Europe. This code covers the CA18DET years only: its records run 1988-07 to 1990-11 and stop there, at which point the SR20 car takes over as RPS13 below. The engine here previously read "CA18DET or SR20DET, model-year dependent" and the span ran to 1993, both of which were RPS13\'s life being attributed to a code that had already ended.'
    },
    'KRS13': {
      id: 'KRS13', chassisPrefix: 'RS13',
      gradeFilter: '6:K',
      generation: 'S13 (Silvia)',
      name: 'Nissan 180SX Super HICAS (KRS13)',
      shortName: '180SX Super HICAS',
      chassisCode: 'E-KRS13',
      bodyStyle: '3-Door Hatchback',
      years: '1988 – 1990',
      engine: 'CA18DET 1.8L Turbo',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The Super HICAS (rear-wheel steering) counterpart to RS13 — same relationship KPS13 has to PS13, one physical file apart. Split out rather than left folded into RS13\'s count.'
    },

    // RPS13 and KRPS13 — the SR20 180SX, added 2026-08-22.
    //
    // 86,565 records that had never been extracted. RS13 above is only the
    // first two and a half years of the 180SX: it runs 1988-07 to 1990-11 and
    // stops. Everything after that wears the RPS13 code, and none of it was
    // here — the site held 26,740 of the 113,305 180SX records in the source,
    // 24%, while describing RS13 as the 180SX outright.
    //
    // The handover is clean and dated. RS13 ends 1990-11; RPS13 has five
    // pre-production cars (one in 1990-03, four in 1990-11) and then goes to
    // volume in 1990-12 with 845, which is the January 1991 SR20 car arriving.
    //
    // KRPS13 needs its own chassisStamp for the same reason KPS13 does, and
    // the data says so just as plainly: its serials collide with RPS13's on
    // 8,997 of its 11,655 records, so the two are running separate numbering
    // sequences and cannot share a printed prefix without inventing thousands
    // of duplicate chassis numbers. Position 1 of the model code separates
    // them cleanly — RPS13 carries S or Z there, KRPS13 always K.
    'RPS13': {
      id: 'RPS13', chassisPrefix: 'RPS13',
      gradeFilter: '1:!K',
      generation: 'S13 (Silvia)',
      name: 'Nissan 180SX (RPS13)',
      shortName: '180SX (SR20)',
      chassisCode: 'E-RPS13',
      bodyStyle: '3-Door Hatchback',
      years: '1990 – 1998',
      engine: 'SR20DE 2.0L / SR20DET 2.0L Turbo',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The 180SX for most of its life — the SR20 car that replaced the CA18DET RS13 at the end of 1990 and ran to December 1998, outlasting the Silvia coupe it shares a platform with by two years. 74,910 records, nearly three times the RS13 count.'
    },
    'KRPS13': {
      id: 'KRPS13', chassisPrefix: 'RPS13', chassisStamp: 'KRPS13',
      gradeFilter: '1:K',
      generation: 'S13 (Silvia)',
      name: 'Nissan 180SX Super HICAS (KRPS13)',
      shortName: '180SX SR20 HICAS',
      chassisCode: 'E-KRPS13',
      bodyStyle: '3-Door Hatchback',
      years: '1990 – 1998',
      engine: 'SR20DE 2.0L / SR20DET 2.0L Turbo',
      transmission: '5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The Super HICAS (rear-wheel steering) 180SX of the SR20 era, standing to RPS13 as KRS13 does to RS13. 11,655 records, on its own chassis numbering sequence rather than RPS13\'s.'
    },

    // =========================================================
    // NISSAN LEGENDS — S15 GENERATION (1999 – 2002)
    // =========================================================
    // Added 2026-08-22. The S15 was missing from this archive outright — all
    // 39,138 records of it, the last Silvia and the last of the S-chassis.
    //
    // It was missed because the completeness audit was scoped to the
    // generations the site already had (R32, R33, R34, S13, S14, Z32, C34), so
    // a generation that had never been added could not show up as absent. The
    // audit answers "is what we have complete", not "is there something we
    // never thought of", and those are different questions.
    //
    // Counting it took two fixes, both the same class of bug the R34 audit hit.
    // The record walk rejected any match preceded by a letter, a guard meant to
    // stop "R32" matching inside "ECR32" — but S15 record tails carry data, and
    // one ends 00 00 12 52 where 0x52 is "R", so the next record was discarded
    // and a phantom "RS15" was found one byte earlier reading the same fields.
    // That invented two chassis codes, RS15 and CS15, and lost 4,912 records.
    // And the two-digit year was read as 1900s, cutting the car off at 1999-12
    // when it ran to 2002-08.
    'S15': {
      id: 'S15', chassisPrefix: 'S15',
      generation: 'S15 (Silvia)',
      name: 'Nissan Silvia (S15)',
      shortName: 'S15',
      chassisCode: 'GF-S15',
      bodyStyle: '2-Door Coupe',
      years: '1998 – 2002',
      engine: 'SR20DE 2.0L / SR20DET 2.0L Turbo',
      transmission: '6-Speed Manual / 5-Speed Manual / 4-Speed Auto',
      drivetrain: 'RWD',
      badgeClass: 'badge-nissan',
      description: 'The last Silvia, built October 1998 to August 2002 — and the car that brought the six-speed to the S-chassis. Volume 089 documents it properly: five option positions, each with its own alphabet, so a plate reading C--A- is four standard positions and one option. The same volume names the Autech cars by their option group rather than a separate chassis code — PB4/PB6 is the Autech Version 6MT, UA3/UA4 the Varietta, TKA/TK1/TKB/TK2 the Style-A and LVT the Driving Helper.'
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

    // M35 Stagea (NM35, HM35, PM35, PNM35) is intentionally not included —
    // see the file header note. The Stagea on this site is the C34 only.

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
    'S13', 'PS13', 'KPS13', 'KS13', 'RS13', 'KRS13', 'RPS13', 'KRPS13', 'S14', 'CS14', 'S15',
    'WGC34', 'WHC34', 'WGNC34', 'WGNC34_260RS',
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
      'bnr32','hcr32','hnr32','hr32','fr32','ecr32','er32',
      's13','ps13','ks13','rs13','rps13','s14','cs14','s15',
      // M35 Stagea (nm35, hm35, pm35, pnm35) is deliberately not listed —
      // see the scope note in the file header. The four files stay in
      // public/data; they are simply not fetched.
      //
      // Three more families are held the same way, extracted but not served:
      //
      //   S110 Silvia 1979-1983   s110, ps110, us110          73,184
      //   S12  Silvia 1983-1988   s12, js12, us12             28,170
      //   Z31  300ZX  1983-1989   z31, gz31, hz31, pz31,      35,381
      //                           hgz31, pgz31
      //
      // 136,735 records in twelve files, decoded and checkable, deliberately
      // outside the site's scope. Adding any of them to this list is all it
      // would take to serve them — but each also needs an entry in models{}
      // below, or it loads records with nothing to display them under.
      'wgc34','whc34','wgnc34',
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
      // Standard-for-grade equipment, which is deliberately absent from the
      // plate — see _bnr32GradeStandard.
      gradeStandard: this.gradeStandard(physicalId, this._decodeGrade(physicalId, col.dict.mc[col.mci[i]] || '', date)),
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
    // S14/CS14 — CORRECTED. This mapping was the wrong way round, on all
    // 84,826 S14 and CS14 records, until the S15 was decoded.
    //
    // The old note said position 4 was "'T' (SR20DET turbo, real K's engine)
    // or 'U' (SR20DE NA, real Q's engine)", and chose that direction because
    // the 62/38 split matched K's "being the better-selling S14 grade, as
    // commonly reported". Which letter meant turbo was assumed, and then a
    // popularity claim was used to confirm the assumption.
    //
    // What settles it is mc[9], the same character the old note cited as an
    // independent echo without saying which way it pointed. Volume 089's
    // モデル記号の意味 page names it for the S15: 11桁目 燃料装置, E = EGI,
    // U = ターボ. The S14 and S15 share this layout exactly, and on the S14
    // the two characters correspond one-to-one — U with U on 30,384 records,
    // T with E on 50,585, nothing else but 54 strays. So mc[4] = 'U' is the
    // TURBO car, which is the K's.
    //
    // Three further checks, all agreeing:
    //
    //   Gearbox.  'U' is 92.1% manual (27,998 MT / 2,386 AT). 'T' is 54.7%
    //             (27,671 / 22,914). A turbo sports grade skews hard to
    //             manual and a base NA does not. The S15 Spec-R, confirmed
    //             from its own legend, is 94% manual — the same shape.
    //   Autech.   All 272 Autech Version K's MF-T cars (plate P870Z, volume
    //             088) carry mc[4] = 'U'. Autech named those exact cars
    //             K's.
    //   CS14.     Same split, same direction, independently.
    //
    // The consequence is that the NA Q's outsold the turbo K's, 62% to 38%,
    // which is the opposite of the claim the old mapping was built on — and
    // is entirely ordinary for a Japanese-market coupe whose base engine was
    // much cheaper to buy and insure.
    //
    // No further sub-grade (Aero, Aero SE, Aero SE Limited — all real per
    // s-chassis-archive's Japan-market rows) is isolable from any position
    // tried, so those stay folded into K's/Q's.
    if (modelId === 'S14' || modelId === 'CS14') {
      const c = mc[4];
      if (c === 'U') return "K's";
      if (c === 'T') return "Q's";
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
    // S15 — from volume 089's own モデル記号の意味 page, which is the best
    // provenance any grade on this site has: Nissan naming its own
    // characters, rather than a total matched against an outside source.
    //
    //   6桁目  グレード    T = S,  U = S-AERO, R
    //   11桁目 燃料装置    E = EGI (NA),  U = ターボ
    //
    // Plate position maps to this data at platePos = mc index + 2, so those
    // are mc[4] and mc[9]. All 39,138 records had been reading as no grade at
    // all, because nothing here ever looked at mc[4].
    //
    // The legend leaves U ambiguous — one character for two grades — and the
    // fuel character resolves it, because Spec-R is the turbo car and S-AERO
    // is not. That split is not an assumption; the whole archive agrees with
    // it and the gearbox proves it independently:
    //
    //   T + EGI    4,291   MT5 3,084 / AT4 1,207          Spec-S
    //   U + turbo 21,377   MT6 20,071 / AT4 1,306         Spec-R
    //   U + EGI   13,470   MT5 7,874 / AT4 5,596          Spec-S Aero
    //
    // 39,138 records, all accounted for, no leftovers. The six-speed appears
    // on the turbo side and nowhere else — the S15 6MT was Spec-R only — so
    // an alignment error here would have to put the 6MT on the wrong car.
    if (modelId === 'S15') {
      // A coachbuilt car is its own trim, not a spec of the car it started as.
      //
      // These were being counted inside Spec-S and Spec-R, which hid 3,494
      // cars and made the numbers wrong in both directions: it inflated
      // Spec-S by 3,001 (a Varietta is not a Spec-S) and left the Autech
      // variants with no line of their own at all, even though the archive
      // already names every one of them. Grouped by variant rather than by
      // option code, because PB4 and PB6 differ only in privacy glass —
      // that is an option on one trim, not two trims.
      const grp = String(mc).slice(12, 17);
      if (grp.length === 5 && grp[4] === 'Z') {
        const fam = this._s15AutechGrade[grp.slice(0, 3)];
        if (fam) return fam;
      }
      // The grade character alone gives three buckets, and volume 089 says so
      // in a footnote on the same page as the layout:
      //
      //   （注）S/AEROグレードには、spec SのGパッケージ・bパッケージ・
      //         Lパッケージ・Vパッケージ及びSエアロを含みます。
      //
      // "The S/AERO grade includes spec S's G, b, L and V packages, and S
      // Aero." (The second is printed lowercase on the page.) So 'U' is a
      // bundle, not a trim, and reading it as plain "Spec-S Aero" was wrong —
      // it silently merged five things and never showed Spec-R Aero at all.
      //
      // What separates them is the aero body itself, at option position 14.
      // That is a derived split rather than something the legend states, so
      // it needs justifying: if the kit were a freely-orderable option, base
      // Spec-S cars would carry it. NOT ONE of the 1,290 does. It only ever
      // appears on 'U' cars, which is what a grade-linked body kit looks like
      // and not what an option looks like.
      const c = mc[4];
      if (c === 'T') return 'Spec-S';
      if (c !== 'U') return '';
      //
      // The packages were NOT Spec-S only - Spec-R was offered in them too,
      // and the data carries that plainly. The three trim treatments each
      // appear on both sides of the fuel split:
      //
      //                                    NA (S)   turbo (R)
      //   leather, blue stitching + blue    1,331       1,100
      //   silver interior + silver wheel      836         699
      //   punched suede                       957       2,849
      //
      // Same option letters, same equipment, both engines. Reading these as
      // Spec-S only put 4,649 Spec-R package cars under a plain "Spec-R".
      //
      // The two sides are tested differently because the authority differs.
      // On the NA side the footnote settles it outright: S/AERO minus S Aero
      // IS the packages, so the whole non-aero bucket is package cars. On the
      // turbo side nothing states it, so the trim treatment does the work -
      // the same treatments the footnote already established as package
      // equipment on the NA side.
      const aero = this._s15HasAeroBody(mc[12]);
      if (mc[9] === 'U') {
        if (aero) return 'Spec-R Aero';
        return this._s15HasPackageTrim(mc[12]) ? 'Spec-R package (G/b/L/V)' : 'Spec-R';
      }
      return aero ? 'Spec-S Aero' : 'Spec-S package (G/b/L/V)';
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
  // What a grade includes as standard, which the build plate deliberately does
  // NOT tell you.
  //
  // Nissan's own convention, printed in the OPTION CODE LIST legend: a code is
  // emitted only for equipment that varies. Standard equipment is marked
  // ●標準装備（記号不要）— "standard equipment, no code required" — and nothing is
  // written for it. So a V-Spec's Brembo brakes never appear in the option
  // block; what makes it a V-Spec is the 車両仕様 character, which the legend
  // labels for this chassis as 「GT-R 17インチホイール装着車」. The option block only
  // ever carries what was ordered on top of the grade.
  //
  // That is correct but unhelpful on its own — a reader looking at a V-Spec
  // wants to know what a V-Spec is. This table supplies that, and it is kept
  // separate from the plate decode and flagged, because unlike everything in
  // _r32Legend it is NOT read out of Nissan's data files. It is the published
  // specification, and it describes the grade rather than the individual car.
  // Everything here is the PUBLISHED SPECIFICATION for a grade, not a decode of
  // any individual car's record, and it is flagged that way in the UI. It is
  // deliberately short: only the equipment that actually distinguishes the
  // grade, because a longer list would start guessing.
  _gradeStandard: {
    BNR32: {
      'V-Spec': [
        'ATTESA E-TS Pro (retuned torque-split AWD)',
        'Brembo brakes, 324 mm front / 300 mm rear',
        '17-inch BBS wheels, 225/45R17'
      ],
      'V-Spec II': [
        'ATTESA E-TS Pro (retuned torque-split AWD)',
        'Brembo brakes, 324 mm front / 300 mm rear',
        '17-inch BBS wheels, 245/45R17 — wider than V-Spec'
      ]
    },
    BCNR33: {
      'V-Spec': [
        'ATTESA E-TS Pro with Active LSD (A-LSD)',
        '17-inch wheels'
      ],
      'V-Spec LM': [
        'ATTESA E-TS Pro with Active LSD (A-LSD)',
        'Le Mans commemorative edition, Championship Blue'
      ],
      'Autech GT-R': [
        'Four-door GT-R converted by Autech Japan'
      ]
    },
    BNR34: {
      'V-Spec': [
        'ATTESA E-TS Pro with Active LSD (A-LSD)',
        'Carbon-fibre rear diffuser',
        'Stiffened suspension'
      ],
      'V-Spec II': [
        'ATTESA E-TS Pro with Active LSD (A-LSD)',
        'Carbon-fibre bonnet with NACA duct',
        'Stiffer suspension than V-Spec'
      ],
      'V-Spec II Nür': [
        'ATTESA E-TS Pro with Active LSD (A-LSD)',
        'Carbon-fibre bonnet with NACA duct',
        'N1-specification RB26DETT with larger turbochargers',
        'Nür instrumentation, 300 km/h speedometer'
      ],
      'M-Spec Nür': [
        'ATTESA E-TS Pro with Active LSD (A-LSD)',
        'Ripple-control dampers and stiffer rear anti-roll bar',
        'Aluminium bonnet, leather interior',
        'N1-specification RB26DETT with larger turbochargers',
        'Nür instrumentation, 300 km/h speedometer'
      ]
    }
  },
  // The N1 is a deletion specification rather than an addition one, so it is
  // described rather than itemised, and it layers on top of whatever base grade
  // the car carries.
  _n1Standard: [
    'N1-specification RB26DETT — revised turbochargers, uprated oil and water cooling',
    'Air conditioning, audio, rear wiper and ABS deleted'
  ],
  gradeStandard: function(modelId, grade) {
    if (!grade) return null;
    const isN1 = / N1$/.test(grade);
    const base = String(grade).replace(/ N1$| \(Police\)$/, '');
    const table = this._gradeStandard[modelId] || {};
    const list = (table[base] || []).slice();
    if (isN1) for (const t of this._n1Standard) if (!list.includes(t)) list.push(t);
    return list.length ? list : null;
  },

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
  // 車両仕様 on the R32, for the chassis where the legend and the chassis
  // together pin it to one grade.
  //
  // The legend's G bucket is shared — 「GTE、GTS、GTS-T、GTS 25、GTS-4」 — so the
  // character alone names nothing. What resolves it is the chassis, because
  // the chassis fixes the engine: E is RB25DE, and GTS 25 is the only 2.5 in
  // that list. Both RB25DE chassis carry G on 100% of their records (15,475
  // and 2,011), with nothing else in the slot.
  //
  // Only these two are listed. HCR32, HNR32 and HR32 are also 100% G and are
  // probably GTS-T, GTS-4 and GTS/GTE respectively, but "probably" is how
  // wrong labels get shipped: HR32's own records carry three different engine
  // characters, so its G is genuinely ambiguous, and the other two are
  // inferences rather than readings. FR32 is 100% D, which the legend calls
  // GXI while this file has always named the model GTE — a discrepancy worth
  // resolving before either is written into a grade field.
  _r32GradeCodes: {
    ECR32: { G: 'GTS25' },
    ER32:  { G: 'GTS25' }
  },

  // The grade character does not sit at a fixed index on an R32 code: it moves
  // depending on whether the body character was written ("ECR32RGFELBC" puts it
  // at 6, "CR32GYEAA" at 4), which is why this cannot use gradePositions.
  _decodeR32Grade: function(modelId, mc) {
    const table = this._r32GradeCodes[modelId];
    if (!table) return null;
    const L = this._r32Layout(mc);
    if (!L) return null;
    const body = String(mc || '').replace(/\s+R32\s*$/, '');
    return table[body[L.grade]] || null;
  },

  _decodeGrade: function(modelId, mc, date) {
    const r32 = this._decodeR32Grade(modelId, mc);
    if (r32 !== null) return r32;
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
  _noRealGradeSplit: ['ENR33', 'ENR34', 'HR34'],

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
  //   enthusiast-oriented grade. (The M35-generation Stagea is no longer
  //   loaded — see the file header — so C34 is the whole Stagea range here.)
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
    'S13': 3, 'PS13': 4, 'KS13': 3, 'RS13': 4, 'RPS13': 5, 'S14': 5, 'CS14': 5,
    'WGC34': 5, 'WHC34': 5, 'WGNC34': 5
  },
  transmissionR32Models: ['BNR32', 'HCR32', 'HNR32', 'HR32', 'FR32', 'ECR32', 'ER32'],
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
    'BNR34': { 'Y': '6-Speed Manual' },
    // The RB25DE cars use Y for a 5-speed automatic — 「Y オートマチック5速」in
    // the [9108-9411] legend. Exactly the collision the note above warns about:
    // the same letter is a 6-speed manual on BNR34 and something else again on
    // PS13, so it stays out of the shared table and is named per model.
    'ECR32': { 'Y': '5-Speed Automatic' },
    'ER32':  { 'Y': '5-Speed Automatic' }
  },
  _decodeTransmission: function(modelId, mc) {
    if (!mc) return '';
    let ch;
    // KPS13 records live inside the physical 'PS13' file with a leading 'K'
    // ("KS13HFW..." vs "S13HFW...") that shifts every field after it by one
    // character — same H/J-then-F/A shape as plain S13, just offset by 1.
    if (modelId === 'PS13' && mc[0] === 'K') {
      ch = mc[this.transmissionPositions.PS13 + 1];
    } else if (modelId === 'RPS13' && mc[1] === 'K') {
      // Same shape one generation on: the KRPS13 minority inside the physical
      // RPS13 file writes "PKS13..." against RPS13's "PS13...", one character
      // longer, so every field after it shifts by one. Verified on the codes —
      // F/A sits at position 5 across RPS13's 74,910 and at 6 across all
      // 11,655 of KRPS13's, with nothing else at either.
      ch = mc[this.transmissionPositions.RPS13 + 1];
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
  // ---- R34, second option-code window --------------------------------------
  //
  // There was a hand-built table here, transcribed page by page from volume
  // 081 option pages, on the recorded grounds that FASTOP carried exactly one
  // R34 window, 9805-200008. FASTOP carries two. The second is open-ended —
  // its end date is stored as four BLANK bytes rather than a number — and the
  // generator that built factoryOptions.json discarded every record shaped
  // that way, for all four FASTOP generations at once.
  //
  // Both readings survive as a check on each other, and they agree: of the 50
  // codes the hand table defined, FASTOP defines all 50, plus 11 it had
  // missed. Wording differs in 22 of them — "multi-display meter" against
  // "multi-function display" — and one is a real correction: 16桁目 P is
  // FRストラットタワーバー, a FRONT strut tower bar for the 25GT-V, read by
  // hand as "front and rear strut tower bars".
  //
  // So the table is gone and this window arrives from FASTOP like every
  // other. See extract_factory_options.js.

  _factoryOptions: null,   // loaded from data/factoryOptions.json in loadFastData
  _factoryOptionsGen: { 'R33': 'R33', 'R34': 'R34', 'S14': 'S14', 'WC3': 'WC34' },

  // ---- R32 build plate ------------------------------------------------------
  // The R32 predates FASTOP, so there is no option table for it anywhere on the
  // discs — searched, twice, including for the exact equipment wording. What
  // follows is built from this archive's own distributions first, with outside
  // sources used only to name what the data had already isolated.
  //
  // The R32's tail is not the fixed five-slot block the R33/R34 use. Those are
  // exactly five characters, '-' padded, so absolute index IS the field
  // ("-----" is a car with no options, "GJ-FK" has options in slots 0,1,3,4).
  // The R32 writes no padding at all: 1 to 4 characters, never a '-', and the
  // block is LEFT-PACKED, so absolute index is not the field. Reading it as
  // though it were is the mistake every published R32 chart makes.
  //
  // Two independent measurements settle the structure:
  //
  //   Anchoring the block at its right end rather than its left drops the total
  //   per-column entropy on all four R32 chassis (BNR32 4.91 -> 4.35 bits,
  //   HCR32 7.87 -> 6.03, HR32 8.41 -> 5.69, HNR32 6.77 -> 5.26), and turns the
  //   outermost column of the long codes from noise into a near-constant L
  //   (95-100%, entropy 0.04-0.34 bits).
  //
  //   The families say the same thing directly. All 22 distinct 7- and 8-headed
  //   BNR32 codes have a bare twin with an identical body, and the marker is
  //   simply prepended: AA -> 7AA -> 8AA, ZAA -> 7ZAA -> 8ZAA, MA -> 7MA,
  //   NA -> 7NA. Read from the left those look like unrelated option sets; read
  //   as marker-plus-body they are the same car in three model years.
  //
  // So the block is parsed as [series marker][equipment body], the marker is
  // stripped before the body is indexed, and plate position = mc index + 2 (the
  // one-character body-style offset documented at the top of this file) is
  // reported against the character's real index.
  //
  // Anchor point from outside the archive: an owner's own FAST lookup of
  // KBNR32RXFS7AA returns "GT-R標準車 / メーカーオプション無し" — GT-R standard,
  // no factory options. That is body "AA" behind a Series 3 marker, which is
  // what fixes A as the null value in each body slot, and it makes the 22,828
  // BNR32 records whose body is all A's (52.0% of the chassis) reportable as
  // carrying no factory options rather than as three unnamed letters.
  //
  // Anything below marked reported: true is named from outside sources (owner
  // documentation supplied for this work, corroborated by published R32 plate
  // guides) and has NOT been independently confirmed against this archive. It
  // is shown to the reader flagged as such rather than presented as fact.
  //
  // ---- On the 新型車解説書 A7 legend, and why it is NOT used here -----------
  //
  // Nissan's own R32 新型車解説書 (section A7 発売車種, 1. 型式記号の説明) prints a
  // labelled breakdown of the 届出記号 — the registration notification code —
  // worked through the example E-BNR32SKXFCWCBSM. It confirms, from the
  // manufacturer, several fields this archive had already reached on its own:
  // B = RB26 and H = RB20, N = 全輪駆動 + SUPER HICAS, H = ハードトップ4ドア and
  // K = クーペ2ドア (the K is the leading plate character the FAST export drops),
  // X = GT-R and G = GTS, F = 手動5速 and A = 自動4速. Every one of those matches:
  // the grade slot is X on the GT-R and G on all three GTS chassis, and the
  // gearbox slot is F or A and nothing else, across 295,861 records.
  //
  // Its その他 block lists W = パワーステアリング, L = サンルーフ, C = エアコン,
  // B = オポーズド型ディスクブレーキ, S = 4輪アンチスキッド(4WAS), M = LSD,
  // V = オートスポイラー, Z = 寒冷地仕様. That legend does NOT describe the block
  // this file decodes, and it must not be applied to it:
  //
  //   W is パワーステアリング, which every R32 had. It appears in 0.5% of BNR32
  //   codes and 0.0% of HCR32, HR32, HNR32 and FR32 codes.
  //   Only 0.2% (BNR32) to 9.1% (HCR32) of records are built entirely from
  //   legend letters, and only 0.0% to 4.4% are in the legend's own order.
  //   A, the commonest character in this block and often twice on one car, is
  //   not in the legend at all.
  //
  // The 届出記号 and the FAST model code are two different strings that share
  // their front-end fields and not their tails. This is almost certainly the
  // source of the "L = Sunroof" and "L = Projector Headlamps" tables that
  // circulate for the R32: the legend is authentic Nissan documentation, read
  // off this page and then applied to the wrong code. It is recorded here so
  // that it is not applied to the wrong code again.
  //
  // Where the prefix ends is confirmed by Nissan directly. The 1990 GT-R
  // brochure (05108-9081AMM) prints, in its 主要諸元表, 車種型号 KBNR32RXFS —
  // the type code with no option characters after it. Every one of the 14,234
  // GT-Rs this archive holds for 1989 and 1990 carries exactly that prefix,
  // 100.00%, with the option block appended per car. Two other prefix
  // characters are confirmed the same way: the English GT-R service manual's
  // A3 MODEL VARIATION table gives one row only — 4WD, RB26DETT, GT-R, 2-door
  // coupe, manual 5-speed — matching mc[5] R on 100%, mc[6] X, mc[7] F on 100%
  // and mc[8] S on 100%.
  //
  // That brochure also lists the GT-R's equipment, and nearly all of it is
  // standard. The only メーカーオプション it names outright is オーディオレス仕様
  // (audio delete, note 3); 寒冷地仕様 and manual フェンダーミラー appear as the
  // other selectable variants (note 2). Three selectable items, against a
  // Series 1 block that varies in about three places — prepend M/T/R and pair
  // ZG/AA/WW — with T steady at 5.5-6.1% of Series 1 cars in every year.
  // Suggestive, and deliberately not acted on: three candidates against three
  // slots is not an assignment, and FASTOP's R33 table shows Nissan coding
  // combinations rather than one option per letter.
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
  },

  // ---- The option tail, from Nissan's own legend ----------------------------
  //
  // Source: the OPTION CODE LIST program shipped on the FAST discs. Its R32
  // series is 27 pages at H:\AR-JP\JP\079 (MAENOTE.079 indexes them, MAEIMG.079
  // holds them as CCITT Group 4 images, 1280px wide). Pages 1-2 are
  // 「モデル記号の意味」, pages 3-18 the VS記号 / パック記号 / パーソナルコード
  // tables, pages 19-27 the 限定車 listings. The program states outright what
  // it is describing: 「この車両に使用しているモデル記号（モデルナンバープレートの
  // モデル欄）の意味」— the MODEL column of the model number plate, i.e. exactly
  // this field.
  //
  // Full model code, from page 1:
  //   [車体形状][エンジン][サスペンション] R32 [ドア][車両仕様][変速機][燃料装置]
  //     [VS記号 1-3桁][パック記号 2桁]
  // On the GT-R that is K B N R32 R X F S + tail — and the FAST export drops the
  // leading 車体形状 K, which is the -1 plate offset documented at the top of
  // this file, now confirmed from the manufacturer rather than inferred.
  //
  // Two things this settles that were previously derived from distributions.
  // First, the tail really is left-packed: the legend writes 「スペース」against
  // every 標準 row and marks codes ●標準装備（記号不要）— standard, no code
  // emitted — so a standard field simply is not written. Second, the codes are
  // redefined per date window, and the windows are [8905-9108] and [9108-9411],
  // which is where this archive's own vocabulary change sits to the month.
  //
  // The パック記号 is always exactly two characters (「パック記号 2桁で表現」), so
  // it is the last two characters of the tail and the VS記号 is whatever precedes
  // it. That is the same [prepends][2-char terminal] split this file had already
  // reached statistically, and the one-character-terminal alternative noted in an
  // earlier revision is now ruled out.
  _r32Legend: [
    {
      // 2-2. モデル記号の意味（その3）, 採用-廃止［8905-9108］
      from: '1989-05', to: '1991-07',
      // VS 1桁目 and 2桁目. The alphabets are disjoint, so a character decodes
      // without needing to know which 桁 it came from.
      vs: {
        L: 'Projector headlamps',                    // VS1
        P: 'Electronic active full-auto air conditioning',   // VS2
        Q: 'Electronic active sound system',
        Z: 'Cold-region specification',
        M: 'Electronic active full-auto air conditioning + active sound system', // P+Q
        V: 'Electronic active full-auto air conditioning + cold-region spec',    // P+Z
        W: 'Active sound system + cold-region spec',                             // Q+Z
        T: 'Electronic active full-auto air conditioning + active sound system + cold-region spec' // P+Q+Z
      },
      // パック記号 1桁目 / 2桁目, page 3. The two digits carry their own
      // alphabets, so most codes decode compositionally. The atomic list below
      // is checked first and agrees with this wherever both apply — BD is
      // "4WAS + viscous LSD" either way (B = 4輪アンチスキッド, D = ビスカスLSD),
      // as are AB, AC, BA, BC, DB, DC, GA, GC, EB, HA and HC.
      pack1: {
        A: 'standard', B: '4-wheel anti-skid', C: 'sunroof',
        D: 'GT auto spoiler (front only)', E: 'GT auto spoiler and rear spoiler',
        F: '4-wheel anti-skid + sunroof',
        G: '4-wheel anti-skid + GT auto spoiler (front only)',
        H: '4-wheel anti-skid + GT auto spoiler and rear spoiler',
        I: 'sunroof + GT auto spoiler (front only)',
        J: 'sunroof + GT auto spoiler and rear spoiler',
        K: '4-wheel anti-skid + sunroof + GT auto spoiler (front only)',
        L: '4-wheel anti-skid + sunroof + GT auto spoiler and rear spoiler'
      },
      pack2: {
        A: 'standard', B: 'GT-R steering wheel', C: 'Type M specification',
        D: 'viscous LSD', E: 'GT-R steering wheel + viscous LSD',
        F: 'Urban Road', G: 'Urban Road',
        J: 'GTE special seats', K: 'GTE special seats + viscous LSD'
      },
      // Atomic パック記号, pages 4-5 (4ドア系 1/2 and 2/2) and 6-7 (2ドア系).
      // These are the codes that carry a non-zero パーソナルコード — wheels,
      // mirrors, tyres, rear wiper — which the two-digit alphabets above do not
      // reach. The 2-door and 4-door tables agree wherever they overlap, so
      // they are merged here.
      pack: {
        AA: 'No factory options (standard car)',
        ZA: 'Electric retractable mirrors',
        ZB: '185/70SR14 tyres, 14-inch full wheel covers',
        ZJ: 'Electric retractable mirrors, 185/70SR14 tyres, 14-inch full wheel covers',
        ZD: 'GT auto spoiler, 205/60R15 tyres, 15-inch alloys',
        ZE: 'GT auto spoiler, 15-inch alloys',
        ZF: 'GT auto spoiler, 15-inch alloys',
        ZG: 'Rear wiper (GT-R standard car)',
        ZK: 'Viscous LSD, 205/60R15 tyres, 15-inch alloys',
        ZL: 'Viscous LSD, 15-inch alloys',
        BA: '4WAS',
        BC: 'Type M specification, 4WAS',
        BD: '4WAS, viscous LSD',
        AB: 'GT-R steering wheel (4WD standard car)',
        AC: 'Type M specification (Type M standard car)',
        DB: 'GT-R steering wheel, GT auto spoiler',
        DC: 'Type M specification, GT auto spoiler',
        GA: 'GT auto spoiler, 4WAS',
        GC: 'Type M specification, 4WAS, GT auto spoiler',
        SA: '15-inch alloys, GT-R steering wheel (Type S standard car)',
        SB: '15-inch alloys, GT-R steering wheel, GT auto spoiler',
        SD: '15-inch alloys, GT-R steering wheel, 4WS, viscous LSD',
        SE: '15-inch alloys, GT-R steering wheel, GT auto spoiler, 4WAS, viscous LSD',
        SF: 'GT auto spoiler and rear spoiler',
        SG: '15-inch alloys, GT-R steering wheel, GT auto spoiler and rear spoiler, 4WAS, viscous LSD',
        SH: '15-inch alloys, GT-R steering wheel, viscous LSD',
        HA: 'GT auto spoiler and rear spoiler, 4WAS',
        HC: 'Type M specification, 4WAS, GT auto spoiler and rear spoiler',
        EB: 'GT-R steering wheel, GT auto spoiler and rear spoiler',
        SS: '"V Selection" special limited edition'
      }
    },
    {
      // 2-2. モデル記号の意味（その9/その12）, 採用-廃止［9108-9411］, 2ドア系
      from: '1991-08', to: '1994-12',
      vs: {
        L: 'Projector headlamps + fog lamps',        // VS1
        M: 'Projector headlamps',
        2: 'Fluororesin paint',
        3: 'Fluororesin paint + projector headlamps and fog lamps',   // 2+L
        4: 'Fluororesin paint + projector headlamps',                 // 2+M
        7: '16-inch tyre specification',
        8: 'GT-R V-Spec II, 45R tyres',
        N: 'Airbag',                                 // VS2
        P: 'Full-auto air conditioning',
        Z: 'Cold-region specification',
        Q: 'Airbag + full-auto air conditioning',    // N+P
        T: 'Airbag + cold-region specification',     // N+Z
        V: 'Full-auto air conditioning + cold-region specification', // P+Z
        W: 'Airbag + full-auto air conditioning + cold-region specification', // N+P+Z
        9: 'Volcanic-ash countermeasure specification' // VS3
      },
      // パック記号（2ドア系）page 12: 1桁目 then 2桁目, each its own alphabet.
      pack1: {
        A: 'standard', B: 'ABS', C: 'sunroof', D: 'auto spoiler (front)',
        E: 'auto spoiler + rear spoiler', F: 'ABS + sunroof',
        G: 'ABS + auto spoiler (front)', H: 'ABS + auto spoiler and rear spoiler',
        I: 'sunroof + auto spoiler (front)', J: 'sunroof + auto spoiler and rear spoiler',
        K: 'ABS + sunroof + auto spoiler (front)',
        L: 'ABS + sunroof + auto spoiler and rear spoiler',
        M: 'rear wiper delete', N: 'rear spoiler delete',
        P: 'rear wiper delete + rear spoiler delete'
      },
      pack2: { A: 'standard', B: 'leather seats', C: 'viscous LSD', D: 'leather seats + viscous LSD' },
      // Two-character codes that are atomic rather than 1桁目+2桁目 (page 15).
      pack: {
        // The legend dates this ★[9108-9302] under GT-R and ★[9302- ] under
        // GT-R 17インチホイール装着車. This archive splits it 118 / 64 + 63 on
        // exactly those boundaries, and gtr-registry's independently compiled
        // figures are 118 GT-R N1, 64 V-Spec N1, 63 V-Spec II N1.
        ZN: 'N1 specification',
        SS: '"V Selection II" limited edition',
        // The 限定車 codes, pages 13-16. Each family is a base limited edition
        // plus the same two options against it, ABS and viscous LSD, so they
        // are written out rather than composed — the digit is not an alphabet,
        // it is an index into the family. The 4-door pages (13, 14) and 2-door
        // pages (15, 16) agree on every code they share.
        S1: '15-inch alloys, rear spoiler with high-mount stop lamp, leather-wrapped sports steering wheel',
        S2: '15-inch alloys, rear spoiler with high-mount stop lamp, leather-wrapped sports steering wheel + ABS',
        Q1: '"GTE Type X,V" limited edition',
        Q2: '"GTE Type X,V" limited edition + ABS',
        Q3: '"GTE Type X,V" limited edition + viscous LSD',
        Q4: '"GTE Type X,V" limited edition + ABS + viscous LSD',
        Q5: '"GTE V Selection 60th Anniversary" limited edition',
        Q6: '"GTE V Selection 60th Anniversary" limited edition + ABS',
        Q7: '"GTE V Selection 60th Anniversary" limited edition + viscous LSD',
        Q8: '"GTE V Selection 60th Anniversary" limited edition + ABS + viscous LSD',
        T1: '"GTS Type J 60th Anniversary" limited edition',
        T2: '"GTS Type J 60th Anniversary" limited edition + ABS',
        T3: '"GTS Type J 60th Anniversary" limited edition + viscous LSD',
        T4: '"GTS Type J 60th Anniversary" limited edition + ABS + viscous LSD',
        T5: '"GTS V Selection 60th Anniversary" limited edition',
        T6: '"GTS V Selection 60th Anniversary" limited edition + ABS',
        T7: '"GTS V Selection 60th Anniversary" limited edition + viscous LSD',
        T8: '"GTS V Selection 60th Anniversary" limited edition + ABS + viscous LSD',
        U1: '"GTS-t Type M 60th Anniversary" limited edition, viscous LSD standard',
        U2: '"GTS-t Type M 60th Anniversary" limited edition + ABS',
        U3: '"GTS-t Type M 60th Anniversary" limited edition + leather seats',
        U4: '"GTS-t Type M 60th Anniversary" limited edition + ABS + leather seats',
        V1: '"GTS SV" limited edition',
        V2: '"GTS SV" limited edition + ABS',
        V3: '"GTS SV" limited edition + viscous LSD',
        V4: '"GTS SV" limited edition + ABS + viscous LSD',
        W1: '"GTS25 SV" limited edition',
        W2: '"GTS25 SV" limited edition + ABS',
        W3: '"GTS25 SV" limited edition + viscous LSD',
        W4: '"GTS25 SV" limited edition + ABS + viscous LSD',
        X1: '"GTE SV" limited edition',
        X2: '"GTE SV" limited edition + ABS',
        X3: '"GTE SV" limited edition + viscous LSD',
        X4: '"GTE SV" limited edition + ABS + viscous LSD'
      }
    }
  ],
  // Codes this archive carries that the pages above do not name: pack RA (560
  // records) and WW (100) and ZH (1) in the first window, Y1 (14) and RN (1) in
  // the second. RA is the Nismo — 560 records is the published Group A
  // homologation build exactly, all Series 1, all paint KH2 Gun Grey Metallic,
  // all built 1989-12 to 1990-03, matching gtr-registry on count, colour, series
  // and window. Y1 and RN follow the limited-edition code shape (V1-V4, W1-W4,
  // X1-X4, T1-T8, U1-U4 are all 限定車 on pages 13-16), so the 限定車発売車種
  // 一覧表 on pages 19-27 is where they will be.
  _r32PackExtra: {
    RA: { text: 'Nismo (Group A homologation special)', verified: true }
  },



  // ---- Z32: 300ZX / Fairlady Z --------------------------------------------
  //
  // Source: the OPTION CODE LIST volume at H:/AR-JP/JP/132, twelve pages.
  //
  //   [ルーフ][エンジン][シーター] Z32 [車格][変速機][過給][VS記号][パック記号]
  //   ルーフ    スペース 標準 / K Tバールーフ / C コンバーチブル (C from 9208)
  //   エンジン   R VG30DE系      シーター  スペース 2シーター / G 2+2シーター
  //   車格 J GL  変速機 スペース MT / A AT   過給 スペース ノンターボ / S ツインターボ
  //
  // The layout diagrams stop at VS記号 and draw no パック記号 box, which makes the
  // trailing characters look like one long VS code. The records disprove that:
  // RGZ32JASHE7 and RGZ32JAE7 differ by exactly the VS character H over the same
  // pack E7.
  //
  // Two things about this chassis that the other volumes do not do.
  //
  // The tables use THREE symbols and key them: ◎標準, ○オプション, △レスオプション.
  // A delete-option is equipment fitted as standard that the buyer removed, so
  // reading it as an option would say a car HAS what it was ordered WITHOUT.
  // fast_matrix.js separates them by shape and by ink, and the delete case is
  // reported here as "... deleted" rather than folded in.
  //
  // And the pack tables are keyed by more than the code: 車型タイプ (turbo or not)
  // and トランスミッション (MT or AT), with the same code appearing under each and
  // meaning different things. Both are characters in the model code, so both are
  // recoverable per record.
  //
  // What is here: the [8907-9309] window, pages 5 and 6, which covers 56,476 of
  // the 64,866 JDM records. The later windows ([9309-9410], [9410-9701],
  // [9701-9810], [9810- ], pages 7 to 12) are not read across yet.
  //
  // Known limitation: the roof character is the one the export drops, so a
  // convertible cannot be told from a coupe here, and the separate コンバーチブル
  // table on page 6 is therefore not applied.
  _z32Chassis: ['Z32', 'GZ32', 'CZ32', 'GCZ32', 'HZ32'],

  _z32Layout: function(mc) {
    const body = String(mc || '').replace(/\s+Z32\s*$/, '').trimEnd();
    const a = body.indexOf('Z32');
    if (a < 0) return null;
    let i = a + 3;
    // 車格. The [8907-9309] diagram lists only J, and this read only J for a
    // long time — correctly for 62,256 records, because W1 through W3 are 100%
    // J. The [9810- ] diagram on page 3 adds two more: T is VR and X is ZX.
    //
    // Missing them was not a small omission. With X unrecognised the parser
    // advanced nothing, so a code like "XAS70" had its X, A and S all read as
    // VS characters — meaning the grade, the gearbox AND the turbo were each
    // wrong, and three unknown "options" were reported instead. 717 records,
    // almost all of the [9810- ] window, decoded that way.
    const gradeCh = 'JTX'.indexOf(body[i]) >= 0 ? body[i] : '';
    if (gradeCh) i++;
    const trans = body[i] === 'A' ? 'AT' : 'MT';    // 変速機
    if (body[i] === 'A') i++;
    const turbo = body[i] === 'S' ? 'TT' : 'NT';    // 過給
    if (body[i] === 'S') i++;
    return { optionsFrom: i, end: body.length, body: body,
             trans: trans, turbo: turbo, gradeCh: gradeCh };
  },

  _z32Legend: {
    // VS記号, page 4. The later window adds airbag combinations and uses two
    // characters for them, so a VS code here can be one character or two.
    vsEarly: {
      B: 'BOSE audio', H: '4WAS (ABS)', P: 'BOSE audio + leather seats',
      W: 'Leather seats', Z: 'Cold-region specification'
    },
    vsLate: {
      H: 'ABS', D: 'ABS + BOSE audio', L: 'ABS + leather seats',
      R: 'ABS + BOSE audio + leather seats',
      HT: 'ABS + airbag', DT: 'ABS + BOSE audio + airbag',
      LT: 'ABS + leather seats + airbag',
      RT: 'ABS + BOSE audio + leather seats + airbag',
      B: 'BOSE audio', W: 'Leather seats', P: 'BOSE audio + leather seats',
      T: 'Airbag', BT: 'BOSE audio + airbag', TW: 'Leather seats + airbag',
      PT: 'BOSE audio + leather seats + airbag', Z: 'Cold-region specification'
    },
    // パック記号 [8907-9309], pages 5 and 6, by turbo then transmission.
    pack1: {
      // 300ZX non-turbo
      NT: {
        MT: {
          E: 'Power seat deleted',
          E1: 'Cruise control (ASCD) + power seat deleted',
          E2: 'Rear spoiler + power seat deleted',
          E3: 'Cruise control (ASCD) + rear spoiler + power seat deleted',
          E4: 'Power seat',
          E5: 'Cruise control (ASCD) + power seat',
          E6: 'Rear spoiler + power seat',
          E7: 'Cruise control (ASCD) + rear spoiler + power seat',
          E8: 'Power seat deleted',
          F: 'Fender mirrors + power seat deleted',
          F1: 'Fender mirrors + cruise control (ASCD) + power seat deleted',
          F2: 'Fender mirrors + rear spoiler + power seat deleted',
          F3: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat deleted',
          F4: 'Fender mirrors + power seat',
          F5: 'Fender mirrors + cruise control (ASCD) + power seat',
          F6: 'Fender mirrors + rear spoiler + power seat',
          F7: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat',
          F8: 'Fender mirrors + power seat deleted'
        },
        AT: {
          E1: 'Cruise control (ASCD) + power seat deleted',
          E3: 'Cruise control (ASCD) + rear spoiler + power seat deleted',
          E5: 'Cruise control (ASCD) + power seat',
          E7: 'Cruise control (ASCD) + rear spoiler + power seat',
          F1: 'Fender mirrors + cruise control (ASCD) + power seat deleted',
          F3: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat deleted',
          F5: 'Fender mirrors + cruise control (ASCD) + power seat',
          F7: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat'
        }
      },
      // 300ZX twin-turbo
      TT: {
        MT: {
          E: 'Rear spoiler deleted + power seat deleted',
          E1: 'Cruise control (ASCD) + rear spoiler deleted + power seat deleted',
          E2: 'Rear spoiler + power seat deleted',
          E3: 'Cruise control (ASCD) + rear spoiler + power seat deleted',
          E4: 'Rear spoiler deleted + power seat',
          E5: 'Cruise control (ASCD) + rear spoiler deleted + power seat',
          E6: 'Rear spoiler + power seat',
          E7: 'Cruise control (ASCD) + rear spoiler + power seat',
          E8: 'Rear spoiler deleted + power seat deleted',
          F: 'Fender mirrors + rear spoiler deleted + power seat deleted',
          F1: 'Fender mirrors + cruise control (ASCD) + rear spoiler deleted + power seat deleted',
          F2: 'Fender mirrors + rear spoiler + power seat deleted',
          F3: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat deleted',
          F4: 'Fender mirrors + rear spoiler deleted + power seat',
          F5: 'Fender mirrors + cruise control (ASCD) + rear spoiler deleted + power seat',
          F6: 'Fender mirrors + rear spoiler + power seat',
          F7: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat',
          F8: 'Fender mirrors + rear spoiler deleted + power seat deleted'
        },
        AT: {
          E1: 'Cruise control (ASCD) + rear spoiler deleted + power seat deleted',
          E3: 'Cruise control (ASCD) + rear spoiler + power seat deleted',
          E5: 'Cruise control (ASCD) + rear spoiler deleted + power seat',
          E7: 'Cruise control (ASCD) + rear spoiler + power seat',
          F1: 'Fender mirrors + cruise control (ASCD) + rear spoiler deleted + power seat deleted',
          F3: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat deleted',
          F5: 'Fender mirrors + cruise control (ASCD) + rear spoiler deleted + power seat',
          F7: 'Fender mirrors + cruise control (ASCD) + rear spoiler + power seat'
        }
      }
    },
    // パック記号 [9309-9410], page 7. Named by WINDOW rather than by number:
    // the R32 legend in this same file uses pack1/pack2 for the first and
    // second DIGIT of one code, which is a different idea entirely.
    //
    // Columns group by 車型タイプ, and unlike packW1 the transmission header
    // spans MT and AT together - so a code here means the same on both
    // gearboxes and only the body type keys it. LIMITED is the 首都圏限定車
    // pair from the small second table on the same page.
    packW2: {
      NT: {
        '11': 'No additional equipment',
        '12': 'rear spoiler',
        '13': 'rear spoiler + keyless entry',
        '14': 'rear spoiler + CD player',
        '15': 'rear spoiler + keyless entry + CD player',
        '16': 'keyless entry + CD player',
        '17': 'keyless entry',
        '18': 'CD player',
        '91': 'fender mirrors'
      },
      TT: {
        '11': 'rear spoiler deleted',
        '12': 'rear spoiler',
        '13': 'rear spoiler + keyless entry',
        '14': 'rear spoiler + CD player',
        '15': 'rear spoiler + keyless entry + CD player',
        '16': 'rear spoiler deleted + keyless entry + CD player',
        '17': 'rear spoiler deleted + keyless entry',
        '18': 'rear spoiler deleted + CD player',
        '92': 'rear spoiler + fender mirrors'
      },
      CONV: {
        '16': 'keyless entry + CD player',
        '17': 'keyless entry',
        '97': 'keyless entry + fender mirrors'
      },
      LIMITED: {
        '52': 'rear spoiler',
        '59': 'rear spoiler + audio deleted'
      }
    },
    // パック記号 [9410-9701], pages 8 and 9. These pages carry no body or gearbox split at all:
    // the code alone keys the table.
    packW3: {
      '21': 'no audio + electronic audio deleted + manual air conditioning + rear spoiler + sports seats + Version S',
      '22': 'no audio + electronic audio deleted + manual air conditioning + BBS wheels + rear spoiler + sports seats + Version S',
      '23': 'electronic audio + manual air conditioning + rear spoiler + sports seats + Version S',
      '24': 'electronic audio + CD player + manual air conditioning + rear spoiler + sports seats + Version S',
      '25': 'electronic audio + manual air conditioning + BBS wheels + rear spoiler + sports seats + Version S',
      '26': 'electronic audio + CD player + manual air conditioning + BBS wheels + rear spoiler + sports seats + Version S',
      '31': 'no audio + electronic audio deleted + BBS wheels + cloth seats + multi remote entry system deleted + new cross-linked fluorine paint deleted + Version S',
      '32': 'electronic audio + cloth seats + multi remote entry system deleted + new cross-linked fluorine paint deleted + Version S',
      '33': 'electronic audio + CD player + cloth seats + multi remote entry system deleted + new cross-linked fluorine paint deleted + Version S',
      '34': 'electronic audio + BBS wheels + cloth seats + multi remote entry system deleted + new cross-linked fluorine paint deleted + Version S',
      '35': 'electronic audio + CD player + BBS wheels + cloth seats + multi remote entry system deleted + new cross-linked fluorine paint deleted + Version S',
      '36': 'electronic audio + multi remote entry system + new cross-linked fluorine paint',
      '37': 'electronic audio + CD player + multi remote entry system + new cross-linked fluorine paint',
      '38': 'electronic audio + BBS wheels + multi remote entry system + new cross-linked fluorine paint',
      '39': 'electronic audio + CD player + BBS wheels + multi remote entry system + new cross-linked fluorine paint',
      '41': 'electronic audio + manual air conditioning + BBS wheels + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '42': 'electronic audio + CD player + manual air conditioning + BBS wheels + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '43': 'electronic audio + manual air conditioning + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '44': 'electronic audio + CD player + manual air conditioning + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '45': 'BOSE audio + automatic air conditioning + BBS wheels + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '46': 'BOSE audio + CD player + automatic air conditioning + BBS wheels + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '47': 'BOSE audio + automatic air conditioning + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '48': 'BOSE audio + CD player + automatic air conditioning + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '53': 'BOSE audio + automatic air conditioning + cruise control (ASCD, automatic only) + BBS wheels + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '54': 'BOSE audio + CD player + automatic air conditioning + cruise control (ASCD, automatic only) + BBS wheels + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '55': 'BOSE audio + automatic air conditioning + cruise control (ASCD, automatic only) + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '56': 'BOSE audio + CD player + automatic air conditioning + cruise control (ASCD, automatic only) + rear spoiler + Recaro seats + mirror-coat T-bar roof + new cross-linked fluorine paint + Version S with Recaro seats',
      '58': 'no audio + electronic audio deleted + cloth seats + multi remote entry system deleted + new cross-linked fluorine paint deleted + Version S',
      '61': 'electronic audio + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '62': 'electronic audio + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '63': 'electronic audio + CD player + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '64': 'electronic audio + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '65': 'electronic audio + CD player + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '66': 'electronic audio + BBS wheels + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '67': 'electronic audio + CD player + BBS wheels + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '68': 'electronic audio + BBS wheels + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '69': 'electronic audio + CD player + BBS wheels + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '71': 'BOSE audio + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '72': 'BOSE audio + CD player + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '73': 'BOSE audio + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '74': 'BOSE audio + CD player + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '75': 'BOSE audio + BBS wheels + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '76': 'BOSE audio + CD player + BBS wheels + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '77': 'BOSE audio + BBS wheels + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '78': 'BOSE audio + CD player + BBS wheels + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '79': 'electronic audio + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '81': 'BOSE audio + cruise control (ASCD, automatic only) + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '82': 'BOSE audio + CD player + cruise control (ASCD, automatic only) + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '83': 'BOSE audio + cruise control (ASCD, automatic only) + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '84': 'BOSE audio + CD player + cruise control (ASCD, automatic only) + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '85': 'BOSE audio + cruise control (ASCD, automatic only) + BBS wheels + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '86': 'BOSE audio + CD player + cruise control (ASCD, automatic only) + BBS wheels + rear spoiler + driver power seat + multi remote entry system + new cross-linked fluorine paint',
      '87': 'BOSE audio + cruise control (ASCD, automatic only) + BBS wheels + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint',
      '88': 'BOSE audio + CD player + cruise control (ASCD, automatic only) + BBS wheels + rear spoiler + driver power seat + driver and passenger power seats + multi remote entry system + new cross-linked fluorine paint'
    },
    // パック記号 [9701-9810], page 10. These pages carry no body or gearbox split at all:
    // the code alone keys the table.
    packW4: {
      '21': 'deck-less with 4 speakers + rear spoiler + manual air conditioning + Version S specification, standard paint',
      '22': 'deck-less with 4 speakers + BBS wheels + rear spoiler + manual air conditioning + Version S specification, standard paint',
      '23': 'AM/FM cassette + rear spoiler + manual air conditioning + Version S specification, standard paint',
      '25': 'AM/FM cassette + BBS wheels + rear spoiler + manual air conditioning + Version S specification, standard paint',
      '31': 'BBS wheels + deck-less with 2 speakers + keyless entry deleted + cloth seats + Super Fine Hard Coat deleted',
      '32': 'AM/FM cassette + keyless entry deleted + cloth seats + Super Fine Hard Coat deleted',
      '34': 'AM/FM cassette + BBS wheels + keyless entry deleted + cloth seats + Super Fine Hard Coat deleted',
      '58': 'deck-less with 2 speakers + keyless entry deleted + cloth seats + Super Fine Hard Coat deleted',
      '61': 'driver power seat + keyless entry',
      '62': 'rear spoiler + driver power seat + keyless entry',
      '66': 'BBS wheels + rear spoiler + driver power seat + keyless entry',
      'A1': 'driver power seat + high-performance glass pack + keyless entry',
      'A2': 'rear spoiler + driver power seat + high-performance glass pack + keyless entry',
      'A3': 'BBS wheels + rear spoiler + driver power seat + high-performance glass pack + keyless entry',
      'B1': 'driver and passenger power seats + leather seats + keyless entry',
      'B2': 'rear spoiler + driver and passenger power seats + leather seats + keyless entry',
      'B3': 'BBS wheels + rear spoiler + driver and passenger power seats + leather seats + keyless entry',
      'B4': 'driver and passenger power seats + leather seats + high-performance glass pack + keyless entry',
      'B5': 'rear spoiler + driver and passenger power seats + leather seats + high-performance glass pack + keyless entry',
      'B6': 'BBS wheels + rear spoiler + driver and passenger power seats + leather seats + high-performance glass pack + keyless entry',
      'C1': 'deck-less with 4 speakers + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C2': 'deck-less with 4 speakers + rear spoiler + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C3': 'deck-less with 4 speakers + BBS wheels + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C4': 'deck-less with 4 speakers + BBS wheels + rear spoiler + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C5': 'AM/FM cassette + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C6': 'AM/FM cassette + rear spoiler + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C7': 'AM/FM cassette + BBS wheels + manual air conditioning + Version R specification, standard paint + Recaro seats',
      'C8': 'AM/FM cassette + BBS wheels + rear spoiler + manual air conditioning + Version R specification, standard paint + Recaro seats'
    },
    // パック記号 [9810- ], pages 11 and 12. These pages carry no body or gearbox split at all:
    // the code alone keys the table.
    packW5: {
      '70': 'No additional equipment',
      '71': 'xenon headlamps',
      '72': 'AM/FM cassette stereo',
      '73': 'rear spoiler',
      '74': 'xenon headlamps + AM/FM cassette stereo',
      '75': 'xenon headlamps + rear spoiler',
      '76': 'AM/FM cassette stereo + rear spoiler',
      '77': 'xenon headlamps + AM/FM cassette stereo + rear spoiler',
      '78': 'leather seats',
      '79': 'xenon headlamps + leather seats',
      '80': 'rear spoiler + leather seats',
      '81': 'xenon headlamps + rear spoiler + leather seats',
      '82': 'BBS alloy wheels',
      '83': 'xenon headlamps + BBS alloy wheels',
      '84': 'AM/FM cassette stereo + BBS alloy wheels',
      '85': 'rear spoiler + BBS alloy wheels',
      '86': 'xenon headlamps + AM/FM cassette stereo + BBS alloy wheels',
      '87': 'xenon headlamps + rear spoiler + BBS alloy wheels',
      '88': 'leather seats + BBS alloy wheels',
      '89': 'xenon headlamps + leather seats + BBS alloy wheels',
      '90': 'rear spoiler + leather seats + BBS alloy wheels',
      '91': 'xenon headlamps + rear spoiler + leather seats + BBS alloy wheels',
      '92': 'bright-polished alloy wheels',
      '93': 'xenon headlamps + bright-polished alloy wheels',
      '94': 'AM/FM cassette stereo + bright-polished alloy wheels',
      '95': 'rear spoiler + bright-polished alloy wheels',
      '96': 'xenon headlamps + AM/FM cassette stereo + bright-polished alloy wheels',
      '97': 'xenon headlamps + rear spoiler + bright-polished alloy wheels',
      '98': 'AM/FM cassette stereo + rear spoiler + bright-polished alloy wheels',
      '99': 'xenon headlamps + AM/FM cassette stereo + rear spoiler + bright-polished alloy wheels',
      'D1': 'leather seats + bright-polished alloy wheels',
      'D2': 'xenon headlamps + leather seats + bright-polished alloy wheels',
      'D3': 'rear spoiler + leather seats + bright-polished alloy wheels',
      'D4': 'xenon headlamps + rear spoiler + leather seats + bright-polished alloy wheels',
      'E1': 'Super Fine Hard Coat',
      'E2': 'xenon headlamps + Super Fine Hard Coat',
      'E3': 'AM/FM cassette stereo + Super Fine Hard Coat',
      'E4': 'rear spoiler + Super Fine Hard Coat',
      'E5': 'xenon headlamps + AM/FM cassette stereo + Super Fine Hard Coat',
      'E6': 'xenon headlamps + rear spoiler + Super Fine Hard Coat',
      'E7': 'AM/FM cassette stereo + rear spoiler + Super Fine Hard Coat',
      'E8': 'xenon headlamps + AM/FM cassette stereo + rear spoiler + Super Fine Hard Coat',
      'F1': 'BBS alloy wheels + Super Fine Hard Coat',
      'F2': 'xenon headlamps + BBS alloy wheels + Super Fine Hard Coat',
      'F3': 'AM/FM cassette stereo + BBS alloy wheels + Super Fine Hard Coat',
      'F4': 'xenon headlamps + AM/FM cassette stereo + BBS alloy wheels + Super Fine Hard Coat',
      'G1': 'bright-polished alloy wheels + Super Fine Hard Coat',
      'G2': 'xenon headlamps + bright-polished alloy wheels + Super Fine Hard Coat',
      'G3': 'AM/FM cassette stereo + bright-polished alloy wheels + Super Fine Hard Coat',
      'G4': 'rear spoiler + bright-polished alloy wheels + Super Fine Hard Coat',
      'G5': 'xenon headlamps + AM/FM cassette stereo + bright-polished alloy wheels + Super Fine Hard Coat',
      'G6': 'xenon headlamps + rear spoiler + bright-polished alloy wheels + Super Fine Hard Coat',
      'G7': 'AM/FM cassette stereo + rear spoiler + bright-polished alloy wheels + Super Fine Hard Coat',
      'G8': 'xenon headlamps + AM/FM cassette stereo + rear spoiler + bright-polished alloy wheels + Super Fine Hard Coat'
    },
  },

  // ---- S13 family: Silvia and 180SX -----------------------------------------
  //
  // Source: the OPTION CODE LIST volumes for these cars — H:/AR-JP/JP/087 for
  // the Silvia (18 pages) and 084 for the 180SX (17 pages). Same programme and
  // the same grammar as the R32: a model code whose tail is left-packed, read as
  // VS記号 characters followed by a two-character パック記号.
  //
  // Model code, from page 1 of each volume:
  //   [車体形状][エンジン種類] S13 [スペース][車格][変速機][燃料供給装置][VS記号][パック記号]
  //
  // Two things about the prefix matter for parsing. 車格 無記号 is J'S, so on a
  // J's car that character is simply ABSENT and everything after it shifts left
  // by one — reading a fixed offset put 179 records' options one slot out. And
  // the 180SX uses its own 車格 alphabet, D = TYPE I and J = TYPE II, which is
  // where the site's existing Type I / Type II names come from, now confirmed
  // from Nissan rather than inferred.
  //
  // The pack code is two digits, and unlike the R32 the same number means
  // different things in different date windows, so the windows are kept separate
  // and matched on build date, with a fallback to any window that defines the
  // code.
  //
  // The VS tables from the two windows are merged: they share L, W and Z with
  // identical meanings, conflict nowhere, and letters genuinely appear either
  // side of the boundary in this archive. Keeping them split cost 6,231 records.
  //
  // The pack matrices were read by fast_matrix.js rather than by eye. On these
  // pages a circle is 56 dark pixels and an empty cell is exactly 0, so there is
  // no threshold to misjudge.
  //
  // 329,381 records, 100.000% fully recognised bar a single oddity reading
  // LS13ANS3, which fits no layout here.
  // RPS13 is here too, and needed no new layout code: _s13Layout anchors on
  // "13" inside the model code rather than on a fixed offset, so "PS13JAT" and
  // "PKS13JAT23" walk the same fields as "S13JFTW" does.
  _s13Chassis: ['S13', 'PS13', 'KS13', 'RS13', 'RPS13'],

  _s13Layout: function(mc) {
    const body = String(mc || '').replace(/\s+R?S13?\s*$/, '').trimEnd();
    const a = body.indexOf('13');
    if (a < 0) return null;
    let i = a + 2;
    // 車格: H = Q's, J = K's on the Silvia and TYPE II on the 180SX, D = TYPE I.
    // 無記号 = J'S, so the character is absent entirely on a J's car.
    if ('HJD'.indexOf(body[i]) >= 0) i++;
    if (body[i] === 'F' || body[i] === 'A') i++;   // 変速機
    if (body[i] === 'T') i++;                      // 燃料供給装置, turbo
    return { optionsFrom: i, end: body.length, body: body };
  },

  // The 180SX's own pack windows, which are NOT the Silvia's.
  //
  // _s13Window below splits at 9101, 9201 and 9205; volume 084 splits the
  // 180SX at 9101, 9201, 9608 and 9710. Same legend file, different car,
  // different dates - using the Silvia's boundaries here would read a code
  // against the wrong table for most of the SR20 car's life.
  _rs13Window: function(date) {
    const d = String(date || '');
    if (!d || d < '1991-01') return 'W1';   // the RS table, [8903-9101]
    if (d < '1992-01') return 'W2';         // [9101-9201]
    if (d < '1996-08') return 'W3';         // [9201-9608]
    if (d < '1997-10') return 'W4';         // [9608-9710]
    return 'W5';                            // [9710- ]
  },

  _s13Window: function(date) {
    const d = String(date || '');
    if (!d || d < '1991-01') return 'W1';
    if (d < '1992-01') return 'W2';
    if (d < '1992-05') return 'W3';
    return 'W4';
  },

  _s13Legend: {
    // VS記号, from pages 4-5 of volume 087 and pages 4/10/13 of 084, merged.
    vs: {
      K: 'HICAS',
      L: 'Viscous LSD',
      W: 'Electric sliding glass sunroof (detachable sunroof on the 180SX)',
      X: 'Dia specification',
      Y: 'Dia + cold-region specification',
      Z: 'Cold-region specification',
      B: "Digital-display auto air conditioning + silver-polish alloy wheels (Q's SC)",
      C: 'Auto air conditioning',
      E: 'Club Package: digital full-auto air conditioning, bright alloy wheels, CD deck, rear spoiler, triple projector headlamps, fluororesin paint',
      M: 'Fluororesin paint',
      P: 'Fluororesin paint + cold-region specification',
      8: 'Fluororesin paint + Kagoshima (volcanic ash) specification',
      9: 'Kagoshima (volcanic ash) specification',
      // From volume 084 page 13, the [9201- ] VS table — the window that runs
      // most of the SR20 180SX's life and had never been read here.
      //
      // These two were the largest single hole left in the archive: G appears
      // on 53,786 records and H on 6,470, and both decoded to nothing. "GM" on
      // its own is the most common option string RPS13 has, 27,380 cars.
      //
      // Safe to put in this shared table rather than a window-keyed one: G and
      // H appear on RPS13 and on no other chassis in the family — zero records
      // in S13, PS13, KS13 or RS13 carry either — so there is nothing here for
      // them to mislabel.
      //
      // G is a grade marker sitting in an options field, which is the legend's
      // own arrangement, not a reading of it. Page 3's layout diagram says the
      // same thing from the other side: 車格 J means TYPE III or TYPE/X
      // 「VS記号がGの場合」.
      G: 'TYPE III / TYPE X specification',
      H: 'ABS'
    },
    // パック記号. Silvia windows first, then the 180SX's own table.
    //
    // On the 180SX table several codes carry identical feature sets — 11 and 18,
    // 20 and 22, 23 and 24, 26 and 28, 31 and 33. That is what the legend
    // prints. Its table has a single "no audio" row where the Silvia's has two
    // audio rows, so the pairs most likely differ by audio type, which the page
    // does not record. Stored as printed rather than given an invented
    // distinction.
    pack: {
      // [8805-9101]
      W1: {
        10: '6JJx15 alloy road wheels',
        11: '6JJx15 alloy road wheels + front window display + hybrid meter',
        12: '6JJx15 alloy road wheels + front window display + hybrid meter + 4-wheel ABS',
        13: '6JJx15 alloy road wheels + front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack)',
        14: '6JJx15 alloy road wheels + front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        15: '6JJx15 alloy road wheels + front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack) + no audio',
        16: '6JJx15 alloy road wheels + front window display + hybrid meter + 4-wheel ABS + AM/FM cassette radio + 4 heated speakers',
        17: '6JJx15 alloy road wheels + front window display + hybrid meter + 4-wheel ABS + no audio',
        18: '6JJx15 alloy road wheels + front window display + hybrid meter + Super Performance Pack (S-Pack)',
        19: '6JJx15 alloy road wheels + front window display + hybrid meter + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        20: '6JJx15 alloy road wheels + front window display + hybrid meter + Super Performance Pack (S-Pack) + no audio',
        21: '6JJx15 alloy road wheels + front window display + hybrid meter + AM/FM cassette radio + 4 heated speakers',
        22: '6JJx15 alloy road wheels + front window display + hybrid meter + no audio',
        23: '6JJx15 alloy road wheels + 4-wheel ABS',
        24: '6JJx15 alloy road wheels + 4-wheel ABS + Super Performance Pack (S-Pack)',
        25: '6JJx15 alloy road wheels + 4-wheel ABS + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        26: '6JJx15 alloy road wheels + 4-wheel ABS + Super Performance Pack (S-Pack) + no audio',
        27: '6JJx15 alloy road wheels + 4-wheel ABS + AM/FM cassette radio + 4 heated speakers',
        28: '6JJx15 alloy road wheels + 4-wheel ABS + no audio',
        29: '6JJx15 alloy road wheels + Super Performance Pack (S-Pack)',
        30: '6JJx15 alloy road wheels + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        31: '6JJx15 alloy road wheels + Super Performance Pack (S-Pack) + no audio',
        32: '6JJx15 alloy road wheels + AM/FM cassette radio + 4 heated speakers',
        33: '6JJx15 alloy road wheels + no audio',
        34: 'Front window display + hybrid meter',
        35: 'Front window display + hybrid meter + 4-wheel ABS',
        36: 'Front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack)',
        37: 'Front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        38: 'Front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack) + no audio',
        39: 'Front window display + hybrid meter + 4-wheel ABS + AM/FM cassette radio + 4 heated speakers',
        40: 'Front window display + hybrid meter + 4-wheel ABS + no audio',
        41: 'Front window display + hybrid meter + Super Performance Pack (S-Pack)',
        42: 'Front window display + hybrid meter + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        43: 'Front window display + hybrid meter + Super Performance Pack (S-Pack) + no audio',
        44: 'Front window display + hybrid meter + AM/FM cassette radio + 4 heated speakers',
        45: 'Front window display + hybrid meter + no audio',
        46: '4-wheel ABS',
        47: '4-wheel ABS + Super Performance Pack (S-Pack)',
        48: '4-wheel ABS + Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        49: '4-wheel ABS + Super Performance Pack (S-Pack) + no audio',
        50: '4-wheel ABS + AM/FM cassette radio + 4 heated speakers',
        51: '4-wheel ABS + no audio',
        52: 'Super Performance Pack (S-Pack)',
        53: 'Super Performance Pack (S-Pack) + AM/FM cassette radio + 4 heated speakers',
        54: 'Super Performance Pack (S-Pack) + no audio',
        55: 'AM/FM cassette radio + 4 heated speakers',
        56: 'No audio',
        70: 'Leather specification',
        71: 'Super Performance Pack (S-Pack) + leather specification',
        72: 'Front window display + hybrid meter + Super Performance Pack (S-Pack) + leather specification',
        73: '4-wheel ABS + Super Performance Pack (S-Pack) + leather specification',
        74: 'Front window display + hybrid meter + 4-wheel ABS + Super Performance Pack (S-Pack) + leather specification'
      },
      // [9101-9201]
      W2: {
        10: '6JJx15 alloy road wheels',
        11: '6JJx15 alloy road wheels + front window display',
        12: '6JJx15 alloy road wheels + front window display + ABS',
        13: '6JJx15 alloy road wheels + front window display + ABS + Dia Package',
        14: '6JJx15 alloy road wheels + front window display + ABS + Dia Package + holographic sound system',
        15: '6JJx15 alloy road wheels + front window display + ABS + Dia Package + no audio',
        16: '6JJx15 alloy road wheels + front window display + ABS + holographic sound system',
        17: '6JJx15 alloy road wheels + front window display + ABS + no audio',
        18: '6JJx15 alloy road wheels + front window display + Dia Package',
        19: '6JJx15 alloy road wheels + front window display + Dia Package + holographic sound system',
        20: '6JJx15 alloy road wheels + front window display + Dia Package + no audio',
        21: '6JJx15 alloy road wheels + front window display + holographic sound system',
        22: '6JJx15 alloy road wheels + front window display + no audio',
        23: '6JJx15 alloy road wheels + ABS',
        24: '6JJx15 alloy road wheels + ABS + Dia Package',
        25: '6JJx15 alloy road wheels + ABS + Dia Package + holographic sound system',
        26: '6JJx15 alloy road wheels + ABS + Dia Package + no audio',
        27: '6JJx15 alloy road wheels + ABS + holographic sound system',
        28: '6JJx15 alloy road wheels + ABS + no audio',
        29: '6JJx15 alloy road wheels + Dia Package',
        30: '6JJx15 alloy road wheels + Dia Package + holographic sound system',
        31: '6JJx15 alloy road wheels + Dia Package + no audio',
        32: '6JJx15 alloy road wheels + holographic sound system',
        33: '6JJx15 alloy road wheels + no audio',
        34: 'Front window display',
        35: 'Front window display + ABS',
        39: 'Front window display + ABS + holographic sound system',
        40: 'Front window display + ABS + no audio',
        44: 'Front window display + holographic sound system',
        45: 'Front window display + no audio',
        46: 'ABS',
        50: 'ABS + holographic sound system',
        51: 'ABS + no audio',
        55: 'Holographic sound system',
        56: 'No audio'
      },
      // [9201-9205]
      W3: {
        10: '6JJx15 alloy road wheels',
        11: '6JJx15 alloy road wheels + front window display',
        12: '6JJx15 alloy road wheels + front window display + ABS',
        16: '6JJx15 alloy road wheels + front window display + ABS + holographic sound system',
        17: '6JJx15 alloy road wheels + front window display + ABS + no audio',
        21: '6JJx15 alloy road wheels + front window display + holographic sound system',
        22: '6JJx15 alloy road wheels + front window display + no audio',
        23: '6JJx15 alloy road wheels + ABS',
        27: '6JJx15 alloy road wheels + ABS + holographic sound system',
        28: '6JJx15 alloy road wheels + ABS + no audio',
        32: '6JJx15 alloy road wheels + holographic sound system',
        33: '6JJx15 alloy road wheels + no audio',
        34: 'Front window display',
        35: 'Front window display + ABS',
        39: 'Front window display + ABS + holographic sound system',
        40: 'Front window display + ABS + no audio',
        44: 'Front window display + holographic sound system',
        45: 'Front window display + no audio',
        46: 'ABS',
        50: 'ABS + holographic sound system',
        51: 'ABS + no audio',
        55: 'Holographic sound system',
        56: 'No audio'
      },
      // [9205- ]
      W4: {
        10: '6JJx15 alloy road wheels',
        11: '6JJx15 alloy road wheels + front window display',
        12: '6JJx15 alloy road wheels + front window display + ABS',
        16: '6JJx15 alloy road wheels + front window display + ABS + holographic sound system',
        17: '6JJx15 alloy road wheels + front window display + ABS + no audio',
        21: '6JJx15 alloy road wheels + front window display + holographic sound system',
        22: '6JJx15 alloy road wheels + front window display + no audio',
        23: '6JJx15 alloy road wheels + ABS',
        27: '6JJx15 alloy road wheels + ABS + holographic sound system',
        28: '6JJx15 alloy road wheels + ABS + no audio',
        32: '6JJx15 alloy road wheels + holographic sound system',
        33: '6JJx15 alloy road wheels + no audio',
        34: 'Front window display',
        35: 'Front window display + ABS',
        39: 'Front window display + ABS + holographic sound system',
        40: 'Front window display + ABS + no audio',
        44: 'Front window display + holographic sound system',
        45: 'Front window display + no audio',
        46: 'ABS',
        50: 'ABS + holographic sound system',
        51: 'ABS + no audio',
        55: 'Holographic sound system',
        56: 'No audio',
        88: 'Q-s Square limited edition',
        89: 'ABS + Q-s Square limited edition'
      }
    },
      RS: {
        10: '6JJx15 alloy road wheels',
        11: '6JJx15 alloy road wheels + front window display',
        12: '6JJx15 alloy road wheels + front window display + ABS',
        13: '6JJx15 alloy road wheels + front window display + ABS + spoiler (front and rear)',
        15: '6JJx15 alloy road wheels + front window display + ABS + spoiler (front and rear) + no audio',
        17: '6JJx15 alloy road wheels + front window display + ABS + no audio',
        18: '6JJx15 alloy road wheels + front window display',
        20: '6JJx15 alloy road wheels + front window display + spoiler (front and rear) + no audio',
        22: '6JJx15 alloy road wheels + front window display + spoiler (front and rear) + no audio',
        23: '6JJx15 alloy road wheels + ABS',
        24: '6JJx15 alloy road wheels + ABS',
        26: '6JJx15 alloy road wheels + ABS + spoiler (front and rear) + no audio',
        28: '6JJx15 alloy road wheels + ABS + spoiler (front and rear) + no audio',
        29: '6JJx15 alloy road wheels',
        31: '6JJx15 alloy road wheels + spoiler (front and rear) + no audio',
        33: '6JJx15 alloy road wheels + spoiler (front and rear) + no audio',
        34: 'Front window display',
        35: 'Front window display + ABS',
        36: 'Front window display + ABS',
        38: 'Front window display + ABS + spoiler (front and rear) + no audio',
        40: 'Front window display + ABS + spoiler (front and rear) + no audio',
        41: 'Front window display',
        43: 'Front window display + spoiler (front and rear) + no audio',
        45: 'Front window display + spoiler (front and rear) + no audio',
        46: 'ABS',
        47: 'ABS + spoiler (front and rear)',
        49: 'ABS + spoiler (front and rear) + no audio',
        51: 'ABS + no audio',
        52: 'Spoiler (front and rear)',
        54: 'Spoiler (front and rear) + no audio',
        56: 'No audio',
        60: '6JJx15 alloy road wheels + front window display + ABS + spoiler (front and rear) + rear fog lamp [TYPE II Special Selection]',
        61: '6JJx15 alloy road wheels + front window display + ABS + spoiler (front and rear) + no audio + rear fog lamp [TYPE II Special Selection]',
        62: '6JJx15 alloy road wheels + front window display + spoiler (front and rear) + rear fog lamp [TYPE II Special Selection]',
        63: '6JJx15 alloy road wheels + front window display + spoiler (front and rear) + no audio + rear fog lamp [TYPE II Special Selection]',
        64: '6JJx15 alloy road wheels + ABS + spoiler (front and rear) + rear fog lamp [TYPE II Special Selection]',
        65: '6JJx15 alloy road wheels + ABS + spoiler (front and rear) + no audio + rear fog lamp [TYPE II Special Selection]',
        66: '6JJx15 alloy road wheels + spoiler (front and rear) + rear fog lamp [TYPE II Special Selection]',
        67: '6JJx15 alloy road wheels + spoiler (front and rear) + no audio + rear fog lamp [TYPE II Special Selection]',
        80: '6JJx15 alloy road wheels + spoiler (front and rear) + rear fog lamp + Leather Selection specification [TYPE II Leather Selection, limited edition]',
        81: '6JJx15 alloy road wheels + ABS + spoiler (front and rear) + rear fog lamp + Leather Selection specification [TYPE II Leather Selection, limited edition]',
        82: '6JJx15 alloy road wheels + front window display + spoiler (front and rear) + rear fog lamp + Leather Selection specification [TYPE II Leather Selection, limited edition]',
        83: '6JJx15 alloy road wheels + front window display + ABS + spoiler (front and rear) + rear fog lamp + Leather Selection specification [TYPE II Leather Selection, limited edition]'
      },
    // 180SX パック記号 for the four windows after [8903-9101], which is the
    // RS table above. Read from volume 084 pages 7-9, 11-12, 14-16 by
    // extract_rs13_packs.js.
    //
    // Window-keyed because the codes genuinely collide: 10, 11, 12, 16 and 17
    // all appear in both [9101-9201] and [9201-9608] with different
    // equipment, and 50 appears in three separate windows. A flat table would
    // be wrong for most of this car's life.
    RSpack: {
      W2: {
        '10': '6JJx15 alloy road wheels',
        '11': '6JJx15 alloy road wheels + front window display',
        '12': '6JJx15 alloy road wheels + front window display + ABS',
        '13': '6JJx15 alloy road wheels + front window display + ABS + front and rear spoilers',
        '14': '6JJx15 alloy road wheels + front window display + ABS + front and rear spoilers + electronically controlled active sound system',
        '15': '6JJx15 alloy road wheels + front window display + ABS + front and rear spoilers + no audio',
        '16': '6JJx15 alloy road wheels + front window display + ABS + electronically controlled active sound system',
        '17': '6JJx15 alloy road wheels + front window display + ABS + no audio',
        '18': '6JJx15 alloy road wheels + front window display + front and rear spoilers',
        '19': '6JJx15 alloy road wheels + front window display + front and rear spoilers + electronically controlled active sound system',
        '20': '6JJx15 alloy road wheels + front window display + front and rear spoilers + no audio',
        '21': '6JJx15 alloy road wheels + front window display + electronically controlled active sound system',
        '22': '6JJx15 alloy road wheels + front window display + no audio',
        '23': '6JJx15 alloy road wheels + ABS',
        '24': '6JJx15 alloy road wheels + ABS + front and rear spoilers',
        '25': '6JJx15 alloy road wheels + ABS + front and rear spoilers + electronically controlled active sound system',
        '26': '6JJx15 alloy road wheels + ABS + front and rear spoilers + no audio',
        '27': '6JJx15 alloy road wheels + ABS + electronically controlled active sound system',
        '28': '6JJx15 alloy road wheels + ABS + no audio',
        '29': '6JJx15 alloy road wheels + front and rear spoilers',
        '30': '6JJx15 alloy road wheels + front and rear spoilers + electronically controlled active sound system',
        '31': '6JJx15 alloy road wheels + front and rear spoilers + no audio',
        '32': '6JJx15 alloy road wheels + electronically controlled active sound system',
        '33': '6JJx15 alloy road wheels + no audio',
        '34': 'front window display',
        '35': 'front window display + ABS',
        '46': 'ABS',
        '80': '6JJx15 alloy road wheels + front window display + ABS + front and rear spoilers + rear fog lamp',
        '81': '6JJx15 alloy road wheels + front window display + ABS + front and rear spoilers + electronically controlled active sound system + rear fog lamp',
        '82': '6JJx15 alloy road wheels + front window display + ABS + front and rear spoilers + no audio + rear fog lamp',
        '83': '6JJx15 alloy road wheels + front window display + front and rear spoilers + rear fog lamp',
        '84': '6JJx15 alloy road wheels + front window display + front and rear spoilers + electronically controlled active sound system + rear fog lamp',
        '85': '6JJx15 alloy road wheels + front window display + front and rear spoilers + no audio + rear fog lamp',
        '86': '6JJx15 alloy road wheels + ABS + front and rear spoilers + rear fog lamp',
        '87': '6JJx15 alloy road wheels + ABS + front and rear spoilers + electronically controlled active sound system + rear fog lamp',
        '88': '6JJx15 alloy road wheels + ABS + front and rear spoilers + no audio + rear fog lamp',
        '89': '6JJx15 alloy road wheels + front and rear spoilers + rear fog lamp',
        '90': '6JJx15 alloy road wheels + front and rear spoilers + electronically controlled active sound system + rear fog lamp',
        '91': '6JJx15 alloy road wheels + front and rear spoilers + no audio + rear fog lamp',
        '92': 'front window display + ABS + front and rear spoilers + rear fog lamp',
        '93': 'front and rear spoilers + rear fog lamp'
      },
      W3: {
        '10': '6JJx15 alloy road wheels',
        '11': '6JJx15 alloy road wheels + front window display',
        '12': '6JJx15 alloy road wheels + front window display + ABS',
        '16': '6JJx15 alloy road wheels + front window display + ABS + electronically controlled active sound system',
        '17': '6JJx15 alloy road wheels + front window display + ABS + no audio',
        '21': '6JJx15 alloy road wheels + front window display + electronically controlled active sound system',
        '22': '6JJx15 alloy road wheels + front window display + no audio',
        '23': '6JJx15 alloy road wheels + ABS',
        '27': '6JJx15 alloy road wheels + ABS + electronically controlled active sound system',
        '28': '6JJx15 alloy road wheels + ABS + no audio',
        '32': '6JJx15 alloy road wheels + electronically controlled active sound system',
        '33': '6JJx15 alloy road wheels + no audio',
        '34': 'front window display',
        '35': 'front window display + ABS',
        '39': 'front window display + ABS + electronically controlled active sound system',
        '44': 'front window display + electronically controlled active sound system',
        '46': 'ABS',
        '50': 'ABS + electronically controlled active sound system',
        '55': 'electronically controlled active sound system',
        'B1': 'front window display + rear fog lamp',
        'B2': 'front window display + ABS + rear fog lamp',
        'B3': 'front window display + ABS + electronically controlled active sound system + rear fog lamp',
        'B4': 'front window display + electronically controlled active sound system + rear fog lamp',
        'B5': 'ABS + rear fog lamp',
        'B6': 'ABS + electronically controlled active sound system + rear fog lamp',
        'B7': 'electronically controlled active sound system + rear fog lamp'
      },
      W4: {
        '50': 'No additional equipment',
        '51': 'Super Fine Hard Coat',
        '52': 'no audio',
        '53': 'no audio + Super Fine Hard Coat',
        '60': 'No additional equipment',
        '61': '15-inch alloy road wheels',
        '62': 'No additional equipment',
        '63': '15-inch alloy road wheels',
        '70': 'No additional equipment',
        '71': 'Super Fine Hard Coat',
        '72': 'viscous LSD',
        '73': 'viscous LSD + Super Fine Hard Coat',
        '74': 'no audio',
        '75': 'no audio + Super Fine Hard Coat',
        '76': 'viscous LSD + no audio',
        '77': 'viscous LSD + no audio + Super Fine Hard Coat'
      },
      W5: {
        '50': 'No additional equipment',
        '51': 'Super Fine Hard Coat',
        '52': 'no audio',
        '53': 'no audio + Super Fine Hard Coat',
        '5A': 'privacy glass',
        '5B': 'Super Fine Hard Coat + privacy glass',
        '5C': 'no audio + privacy glass',
        '5D': 'no audio + Super Fine Hard Coat + privacy glass',
        '60': 'No additional equipment',
        '61': '15-inch alloy road wheels',
        '62': 'No additional equipment',
        '63': '15-inch alloy road wheels',
        '6A': 'privacy glass',
        '6B': '15-inch alloy road wheels + privacy glass',
        '6C': 'privacy glass',
        '6D': '15-inch alloy road wheels + privacy glass',
        '80': 'No additional equipment',
        '81': 'Super Fine Hard Coat',
        '82': 'viscous LSD',
        '83': 'viscous LSD + Super Fine Hard Coat',
        '84': 'no audio',
        '85': 'no audio + Super Fine Hard Coat',
        '86': 'viscous LSD + no audio',
        '87': 'viscous LSD + no audio + Super Fine Hard Coat',
        '8A': 'privacy glass',
        '8B': 'Super Fine Hard Coat + privacy glass',
        '8C': 'viscous LSD + privacy glass',
        '8D': 'viscous LSD + Super Fine Hard Coat + privacy glass',
        '8E': 'no audio + privacy glass',
        '8F': 'no audio + Super Fine Hard Coat + privacy glass',
        '8G': 'viscous LSD + no audio + privacy glass',
        '8H': 'viscous LSD + no audio + Super Fine Hard Coat + privacy glass',
        '9A': 'CD selection + rear green glass with ornament',
        '9B': 'Super Fine Hard Coat + CD selection + rear green glass with ornament',
        '9C': 'viscous LSD + CD selection + rear green glass with ornament',
        '9D': 'viscous LSD + Super Fine Hard Coat + CD selection + rear green glass with ornament',
        '9E': 'CD selection + privacy glass',
        '9F': 'Super Fine Hard Coat + CD selection + privacy glass',
        '9G': 'viscous LSD + CD selection + privacy glass',
        '9H': 'viscous LSD + CD selection + privacy glass'
      },
    },
  },

  // Pick the legend window a car's build date falls in, clamping at both ends.
  // The windows record when Nissan maintained each table, and they are narrower
  // than production: HCR32 records start 1989-02 against a legend that begins
  // 8905. Falling through to "no window" there dropped the tail entirely on a
  // few hundred of the earliest cars, so the nearest window is used instead —
  // the same argument this file already applies to the FASTOP windows.
  _r32Window: function(date) {
    const d = String(date || '');
    if (!d) return null;
    for (const w of this._r32Legend) if (d >= w.from && d <= w.to) return w;
    const first = this._r32Legend[0], last = this._r32Legend[this._r32Legend.length - 1];
    if (d < first.from) return first;
    if (d > last.to) return last;
    return null;
  },

  // Split a tail into its VS記号 characters and its two-character パック記号,
  // and name each part. A tail shorter than two characters cannot carry a pack
  // and is reported unsplit.
  _r32Tail: function(tail, win) {
    const out = [];
    if (!tail) return out;
    if (!win || tail.length < 2) {
      for (const ch of tail) out.push({ char: ch, text: null, undecoded: true });
      return out;
    }
    const pack = tail.slice(-2);
    for (const ch of tail.slice(0, -2)) {
      const t = win.vs[ch];
      out.push({ char: ch, field: 'VS', text: t || null, verified: !!t, undecoded: !t });
    }
    // Atomic two-character packs first, then 1桁目 + 2桁目, then this archive's
    // own additions, then unnamed.
    if (win.pack && win.pack[pack]) {
      out.push({ char: pack, field: 'Pack', text: win.pack[pack], verified: true });
    } else if (this._r32PackExtra[pack]) {
      const e = this._r32PackExtra[pack];
      out.push({ char: pack, field: 'Pack', text: e.text, verified: !!e.verified });
    } else if (win.pack1 && win.pack1[pack[0]] && win.pack2 && win.pack2[pack[1]]) {
      const a = win.pack1[pack[0]], b = win.pack2[pack[1]];
      const text = (a === 'standard' && b === 'standard')
        ? 'No factory options (standard car)'
        : (a === 'standard' ? b : (b === 'standard' ? a : a + ' + ' + b));
      out.push({ char: pack, field: 'Pack', text: text.charAt(0).toUpperCase() + text.slice(1), verified: true });
    } else {
      out.push({ char: pack, field: 'Pack', text: null, undecoded: true });
    }
    return out;
  },
  // BNR32 alone. The other R32 chassis write a shorter chassis prefix into the
  // model code — "CR32GAELQKB" and "R32GAEAA" against BNR32's "BNR32RXFSLMZG" —
  // so the same mc index is a different plate position on each of them, and
  // labelling one "(11K)" off BNR32's offset would be a wrong number stated
  // confidently. Until each prefix length is pinned down and checked, they
  // report no plate breakdown rather than a misnumbered one.
  // All seven R32 chassis. Anchoring on the literal "R32" inside the model code
  // and splitting the two prefix variants aligns the whole family, so they all
  // get their gearbox read and their option characters shown in order. Only
  // BNR32 has names for those characters — see _r32Plate.
  //
  // ECR32 and ER32 belong here for the same reason as the rest: same volume,
  // same VS記号 and パック記号 tables, and they carry both prefix variants
  // themselves ("ECR32RGFELBC" with the body character written, "CR32GYEAA"
  // without), which the anchor already handles. Their records sit almost
  // entirely in the [9108-9411] window, which the legend covers.
  _r32Chassis: ['BNR32', 'HCR32', 'HNR32', 'HR32', 'FR32', 'ECR32', 'ER32'],
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
    // 燃料装置 (E = EGI, I = SPI, S = intercooler turbo) is written on every
    // engine except the CA18i, whose codes are just FR32DF / FR32DA — engine,
    // R32, 車両仕様, 変速機 and straight into the options. D is the CA18i GXi
    // and the only 車両仕様 that omits the field, so it is the test. Reading a
    // fuel character that is not there cost FR32 one slot on all 16,881 of its
    // records and left them decoding at 10.8%.
    const hasFuel = body[grade] !== 'D';
    return {
      body: hasBody ? anchor + 3 : -1,
      grade,
      gearbox: grade + 1,
      induction: hasFuel ? grade + 2 : -1,
      optionsFrom: grade + (hasFuel ? 3 : 2),
      end: body.length
    };
  },

  // 変速機. The [8905-9108] legend lists exactly two — F = 5段フロア,
  // A = フロアトルコン — and that held for as long as this archive was the
  // five original R32 chassis: F or A and nothing else across all 295,861.
  //
  // The [9108-9411] legend adds a third, Y = オートマチック5速, and it is not
  // hypothetical: adding ECR32 and ER32 brought in 12,715 records carrying it
  // (every one of ER32's 2,011, and 10,704 of ECR32's 15,475). Without Y here
  // those records fell through to the model's blanket transmission string
  // instead of reading their own plate.
  //
  // An earlier E = "5-speed automatic" entry never fired and is still absent:
  // E does occur on the R32, but in the induction slot (HR32 100%, HCR32
  // 22.7%), one place further along.
  _r32Gearbox: { F: '5-speed manual', A: '4-speed automatic', Y: '5-speed automatic' },

  _decodeR32Plate: function(modelId, mc, date) {
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
    // VS記号 characters, then the two-character パック記号, per the window the
    // car was built in. This runs for every R32 chassis: the legend's tables
    // are one set of codes with per-grade availability columns, not a different
    // scheme per model, and the 2-door and 4-door pages agree wherever they
    // overlap (VS 2桁目 and 3桁目 are identical on pages 8 and 10; the pack
    // 1桁目/2桁目 alphabets are identical on pages 11 and 12).
    //
    // Plate positions are given for all five now. An earlier revision withheld
    // them from the non-GT-R chassis, reasoning that those codes "omit a
    // different number of leading characters" so numbering off BNR32's offsets
    // would be wrong. Checked against the raw MDLCODE strings, that is not what
    // happens: the export drops exactly one leading character on every chassis
    // — KBNR32RXFS→BNR32RXFS, RCR32GAEL→CR32GAEL, HR32GAE→R32GAE, FR32DA→R32DA
    // — so mc index + 2 is the plate position throughout.
    const tail = mc.slice(L.optionsFrom, L.end).replace(/[-\s]/g, '');
    let idx = L.optionsFrom;
    for (const part of this._r32Tail(tail, this._r32Window(date))) {
      opts.push({ pos: idx, platePos: this.platePos(idx), char: part.char,
                  field: part.field, text: part.text,
                  verified: !!part.verified, undecoded: !!part.undecoded });
      idx += part.char.length;
    }
    return opts;
  },

  // VS記号 characters, then the two-digit パック記号, per the window the car was
  // built in. Plate position is mc index + 2 here as everywhere else: the export
  // drops exactly one leading character (S13HA29 -> 13HA29, PS13HACM29 ->
  // S13HACM29, RS13JFT66 -> S13JFT66).
  _decodeS13Plate: function(modelId, mc, date) {
    const opts = [];
    const L = this._s13Layout(mc);
    if (!L) return opts;
    let tail = L.body.slice(L.optionsFrom);
    let idx = L.optionsFrom;

    // The pack is the last two characters, when the last two characters are a
    // pack. Anything before it is VS, and a car can carry VS with no pack.
    //
    // "Two digits" was the test, and it is right for the Silvia and for the
    // early 180SX. It is wrong for the later 180SX, whose codes are
    // alphanumeric: 5A, 5B, 5C, 5D and 6A-6D on the [9710- ] page, B1-B7 on
    // [9201-9608], 8A-8H and 9A-9H. None of those match \d\d, so the pack was
    // never split off and its two characters fell through to be reported as
    // unrecognised VS instead — 4,791 character occurrences on RPS13, which
    // read as a decoding gap when the tables had the codes all along.
    //
    // So ask the tables. A two-character ending that any applicable pack table
    // knows IS the pack; otherwise fall back to the digit pair, which keeps
    // every previously-correct reading exactly as it was.
    let pack = null;
    const cand = tail.length >= 2 ? tail.slice(-2) : null;
    let knows = false;
    if (cand) {
      if (modelId === 'RS13' || modelId === 'RPS13') {
        const RSP = this._s13Legend.RSpack || {};
        knows = !!(this._s13Legend.RS[cand] || (RSP.W2 || {})[cand] ||
                   (RSP.W3 || {})[cand] || (RSP.W4 || {})[cand] || (RSP.W5 || {})[cand]);
      } else {
        knows = ['W1', 'W2', 'W3', 'W4'].some(w => (this._s13Legend.pack[w] || {})[cand]);
      }
    }
    if (cand && (knows || /\d\d$/.test(tail))) { pack = cand; tail = tail.slice(0, -2); }

    for (const ch of tail) {
      const t = this._s13Legend.vs[ch];
      opts.push({ pos: idx, platePos: this.platePos(idx), char: ch, field: 'VS',
                  text: t || null, verified: !!t, undecoded: !t });
      idx++;
    }
    if (pack !== null) {
      let t, exact = true;
      // The 180SX reads from its own volume, and now for its whole life.
      //
      // This used to route only RS13 here, because only [8903-9101] had been
      // read and sending RPS13 to the single RS table decoded barely 60% of
      // its characters — the note that stood here said volume 084's front
      // matter would settle it, and it did. Pages 7-9, 11-12 and 14-16 are the
      // four later windows, now in RSpack.
      //
      // Window first, then the other 180SX windows as a fallback marked
      // reported rather than verified. The fallback matters because the codes
      // collide across windows — 10, 11, 12, 16, 17 and 50 all mean different
      // things in different ones — so a match from the wrong window is a real
      // possibility rather than a formality.
      if (modelId === 'RS13' || modelId === 'RPS13') {
        const RS = this._s13Legend.RS, RSP = this._s13Legend.RSpack || {};
        const byWin = { W1: RS, W2: RSP.W2, W3: RSP.W3, W4: RSP.W4, W5: RSP.W5 };
        const here = this._rs13Window(date);
        t = (byWin[here] || {})[pack];
        if (!t) {
          exact = false;
          for (const w of ['W1', 'W2', 'W3', 'W4', 'W5']) {
            if (w !== here && (byWin[w] || {})[pack]) { t = byWin[w][pack]; break; }
          }
        }
      } else {
        t = this._s13Legend.pack[this._s13Window(date)][pack];
        // The same number means different equipment in different windows, so an
        // out-of-window match is reported rather than presented as confirmed.
        if (!t) { exact = false;
          for (const w of ['W1', 'W2', 'W3', 'W4']) { if (this._s13Legend.pack[w][pack]) { t = this._s13Legend.pack[w][pack]; break; } } }
      }
      opts.push({ pos: idx, platePos: this.platePos(idx), char: pack, field: 'Pack',
                  text: t || null, verified: !!t && exact, reported: !!t && !exact,
                  undecoded: !t });
    }
    return opts;
  },

  // Which パック記号 table applies, by build date.
  //
  // All five windows are now read. Before, only [8907-9309] existed and every
  // later date got an empty table - which did more damage than simply leaving
  // those packs unnamed. With no table the two-character code was never split
  // off the tail at all, so "Z32JAHE7" decoded its E and its 7 as two separate
  // unrecognised VS characters instead of one pack code E7. Every Z32 built
  // from September 1993 on, 8,348 records, read that way.
  //
  // The windows disagree about what keys a code, so this returns a flat
  // code->text map and lets the caller stay simple:
  //   [8907-9309]  body type AND gearbox    pack1[turbo][trans]
  //   [9309-9410]  body type only           packW2[turbo], + the 首都圏限定車 pair
  //   [9410-    ]  nothing - the code alone
  //
  // The convertible is a known blind spot. Its codes live under CONV, but the
  // roof character is the one the FAST export drops, so a convertible cannot
  // be told from a coupe here. CONV is therefore consulted only as a fallback,
  // after the body-typed table has failed - which is right for 97, unique to
  // the convertible, and unavoidable for 16 and 17, which it shares.
  // Returns the window's own table first, then the others as fallbacks.
  //
  // A changeover month contains cars of both kinds, and the counts say so
  // plainly: of the 128 records built in 1993-09, 100 carry a code from the
  // window that opens that month and 28 from the one that closes it. 1994-10
  // splits 72 to 54. So there is no boundary that is simply right, and moving
  // it only trades one set of misses for another.
  //
  // The window that owns the date is therefore tried first and its match is
  // verified; a match found in any other window is still reported, but as
  // "reported" rather than confirmed - the same distinction the R32 and S13
  // decoders already draw for an out-of-window pack.
  _z32PackTables: function(L, d) {
    const Z = this._z32Legend;
    const w1 = (Z.pack1[L.turbo] || {})[L.trans] || {};
    const w2 = Object.assign({}, Z.packW2.CONV, Z.packW2[L.turbo], Z.packW2.LIMITED);
    const all = [w1, w2, Z.packW3, Z.packW4, Z.packW5];
    if (!d) return [{}, ...all];
    const i = d < '1993-09' ? 0 : d < '1994-10' ? 1 : d < '1997-01' ? 2 : d < '1998-10' ? 3 : 4;
    return [all[i], ...all.filter((_, k) => k !== i)];
  },

  // ---- S15 Silvia ---------------------------------------------------------
  //
  // Volume 089, pages 2-6. The layout is positional rather than chassis-led:
  //   [車体形状 G][エンジン BY SR20DE][アクスル A 2WS / B 4WS][R 右ハンドル]
  //   [グレード T S / U S-AERO,R][変速機 F MT5 / Y MT6 / A AT4] S15
  //   [燃料装置 E EGI / U ターボ][仕向地 D 標準地 / Z 寒冷地][特装 4][14-18 options]
  //
  // Each option position has its OWN alphabet, and a dash means standard, so
  // a great many codes read like C--A-. Letters skip I and O throughout.
  _s15Options: {
    '14': {
      '-': 'standard',
      'A': 'rear wiper',
      'B': 'rear wiper + leather trim, red stitching',
      'C': 'rear wiper + pillar gauge, boost + titanium meter finisher',
      'D': 'rear wiper + rear spoiler + side sill protector + leather trim, red stitching + pillar gauge, oil pressure + front fog lamps',
      'E': 'rear wiper + rear spoiler + side sill protector + pillar gauge, boost + front fog lamps + titanium meter finisher',
      'F': 'rear wiper + rear fog lamp',
      'G': 'rear wiper + leather trim, red stitching + rear fog lamp',
      'H': 'rear wiper + pillar gauge, boost + titanium meter finisher + rear fog lamp',
      'J': 'rear wiper + rear spoiler + side sill protector + leather trim, red stitching + pillar gauge, oil pressure + rear fog lamp',
      'K': 'rear wiper + rear spoiler + side sill protector + pillar gauge, boost + titanium meter finisher + rear fog lamp',
      'L': 'rear wiper + front fog lamps + titanium meter finisher + leather trim, blue stitching + blue interior',
      'M': 'rear wiper + titanium meter finisher + rear fog lamp + leather trim, blue stitching + blue interior',
      'N': 'rear wiper + pillar gauge, boost + front fog lamps + titanium meter finisher + leather trim, blue stitching + blue interior',
      'P': 'rear wiper + pillar gauge, boost + titanium meter finisher + rear fog lamp + leather trim, blue stitching + blue interior',
      'Q': 'rear wiper + front fog lamps + silver interior + leather steering wheel, silver stitching',
      'R': 'rear wiper + rear fog lamp + silver interior + leather steering wheel, silver stitching',
      'S': 'rear wiper + pillar gauge, boost + front fog lamps + silver interior + leather steering wheel, silver stitching',
      'T': 'rear wiper + pillar gauge, boost + rear fog lamp + silver interior + leather steering wheel, silver stitching',
      'U': 'rear wiper + titanium meter finisher',
      'V': 'rear wiper + titanium meter finisher + rear fog lamp',
      'W': 'rear wiper + leather trim, red stitching + punched suede-style seats and door trim',
      'X': 'rear wiper + leather trim, red stitching + rear fog lamp + punched suede-style seats and door trim',
      'Y': 'rear wiper + pillar gauge, boost + titanium meter finisher + punched suede-style seats and door trim',
      'Z': 'rear wiper + pillar gauge, boost + titanium meter finisher + rear fog lamp + punched suede-style seats and door trim'
    },
    '15': {
      '-': 'standard',
      'A': '16-inch alloy wheels + rear helical LSD',
      'B': '16-inch alloy wheels',
      'C': 'rear viscous LSD',
      'D': '16-inch alloy wheels, chrome',
      'E': 'steel wheels'
    },
    '16': {
      '-': 'standard',
      'A': 'sunroof',
      'B': 'privacy glass',
      'C': 'sunroof + privacy glass',
      'D': 'remote door lock',
      'E': 'sunroof + remote door lock',
      'F': 'privacy glass + remote door lock',
      'G': 'sunroof + privacy glass + remote door lock',
      'H': 'water-repellent door glass deleted',
      'J': 'sunroof + water-repellent door glass deleted',
      'K': 'privacy glass + water-repellent door glass deleted',
      'L': 'sunroof + privacy glass + water-repellent door glass deleted'
    },
    '17': {
      '-': 'standard',
      'A': 'audio deleted',
      'B': 'holographic sound system + 7 speakers',
      'C': 'TV / navigation system, CD',
      'D': 'TV / navigation system, DVD',
      'E': 'audio deleted + speakers deleted',
      'F': 'J-navi navigation system, CD',
      'G': '1DIN radio with CD and MD'
    },
    '18': {
      '-': 'standard',
      'A': 'interior package, orange',
      'B': 'xenon headlamps',
      'C': 'side airbags',
      'D': 'interior package, orange + xenon headlamps',
      'E': 'interior package, orange + side airbags',
      'F': 'xenon headlamps + side airbags',
      'G': 'interior package, orange + xenon headlamps + side airbags',
      'K': 'headlamp inner silver + aluminium pedals',
      'L': 'xenon headlamps + headlamp inner silver + aluminium pedals',
      'M': 'one-way trunk through + door mirror titanium clear finish deleted',
      'N': 'xenon headlamps + one-way trunk through + door mirror titanium clear finish deleted',
      'P': 'side airbags + one-way trunk through + door mirror titanium clear finish deleted',
      'Q': 'xenon headlamps + side airbags + one-way trunk through + door mirror titanium clear finish deleted'
    },
  },

  // Which of the 14-18 option positions this record carries, and what each says.
  //
  // The stored code drops the leading 車体形状, so plate positions 14-18 land at
  // indexes 12-16 here — the same -1 offset the rest of this file documents.
  // Anchoring on the "S15" marker instead of a fixed index keeps that honest:
  // options start three characters past it, after 燃料装置, 仕向地 and 特装.
  // The Autech-built S15s, from volume 089 page 1.
  //
  // They are not a separate chassis code — they are ordinary S15 records whose
  // OPTION GROUP identifies them, which is why looking for an "Autech S15" in
  // the chassis codes finds nothing. The page lists them as 14-18 patterns with
  // a wildcard at 17 and a Z at 18, and that Z is the tell: it appears on 3,494
  // records and on no ordinary car, because the normal position-18 table has no
  // Z in it at all.
  //
  // Their values at 15 and 16 are outside the standard tables too, so these
  // cars are named as one thing rather than decoded position by position — the
  // ordinary tables would either miss or, worse, mislabel them.
  // Pages 7-10 give each variant TWO codes side by side — Autech's own
  // 架装車種記号 and the モデルナンバープレート車種記号 that is actually stamped.
  // They differ on the Style-A, where Autech's TKA/TKB reaches the plate as
  // TK1/TK2, which is why the records hold TK1 and TK2 and no TKA at all. Both
  // forms are listed so either reads.
  //
  // The pages also separate the pairs within each variant, so these are named
  // to that level rather than lumped:
  //   PB4 / PB6   Autech Version, without / with privacy glass   (page 7)
  //   UA3 / UA4   Varietta, front cloth / front leather seats    (page 8)
  //   TK1 / TK2   Style-A, SR20DET+SR20DE without / SR20DE with privacy glass
  //
  // LVT is the Driving Helper and appears on no record, which page 10 explains:
  // 「モデルナンバープレートには基準車オプション記号が記載されております」— its plate
  // carries the BASE car's option code, so a Driving Helper is not identifiable
  // from the plate at all. It stays listed in case a record ever shows one.
  // Autech variants as GRADES. _s15Autech below names them for the plate
  // readout, at option-code granularity; this collapses those to the trim a
  // buyer would actually have chosen, for the grade breakdown and rarity.
  // Which position-14 option codes carry the aero body — rear spoiler AND
  // side sill protector together. Read out of _s15Options rather than written
  // as a list, so correcting the option table corrects this too instead of
  // leaving a stale set of letters behind.
  _s15AeroCodes: null,
  _s15HasAeroBody: function (ch) {
    if (!this._s15AeroCodes) {
      const t = (this._s15Options && this._s15Options['14']) || {};
      this._s15AeroCodes = new Set(Object.keys(t).filter(k =>
        /rear spoiler/i.test(t[k]) && /side sill/i.test(t[k])));
    }
    return this._s15AeroCodes.has(ch);
  },

  // The package cars are the ones carrying a trim treatment: leather with
  // coloured stitching, a silver interior, or punched suede. Base Spec-S
  // carries NONE of these - 1,290 cars, and every one of them is either
  // "rear wiper" or "rear wiper + rear fog lamp" and nothing more. So a trim
  // treatment is never the base car's equipment.
  _s15TrimCodes: null,
  _s15HasPackageTrim: function (ch) {
    if (!this._s15TrimCodes) {
      const t = (this._s15Options && this._s15Options['14']) || {};
      this._s15TrimCodes = new Set(Object.keys(t).filter(k =>
        /leather trim|silver interior|punched suede/i.test(t[k])));
    }
    return this._s15TrimCodes.has(ch);
  },

  _s15AutechGrade: {
    PB4: 'Autech Version', PB6: 'Autech Version',
    UA3: 'Varietta', UA4: 'Varietta',
    TKA: 'Style-A', TK1: 'Style-A', TKB: 'Style-A', TK2: 'Style-A',
    LVT: 'Driving Helper',
    YNZ: 'Autech special build'
  },

  _s15Autech: {
    PB4: 'Autech Version 6-speed manual, without privacy glass',
    PB6: 'Autech Version 6-speed manual, with privacy glass',
    UA3: 'Varietta (Autech open-top), front cloth seats',
    UA4: 'Varietta (Autech open-top), front leather seats',
    TKA: 'Style-A (Autech)', TK1: 'Style-A (Autech), without privacy glass',
    TKB: 'Style-A (Autech)', TK2: 'Style-A (Autech), with privacy glass',
    LVT: 'Driving Helper (Autech)',
    // 477 records — 333 as YNZ1Z and 144 as YNZ2Z — carry the Autech marker Z
    // at position 18 but a prefix that volume 089 does not list anywhere: not
    // on page 1's summary, nor on the four variant pages. The Z is the whole
    // basis for calling it Autech-built, and that much the records do show,
    // since no ordinary car has a Z there. The variant itself is not named
    // here because the source does not name it.
    YNZ: 'Autech special build (code YNZ, not named in volume 089)'
  },

  // S14 coachbuilt plates, read as a whole 5-character group rather than
  // position by position — the same shape the S15's Autech cars use, and for
  // the same reason: the group is one identifier, not five option slots, so
  // decoding it a character at a time produces five unknowns instead of one
  // answer. That is exactly what these were doing: 302 cars accounted for
  // 1,480 of the S14's undecodable characters.
  //
  // The trailing Z is the marker on both generations.
  _s14Autech: {
    // Volume 088's entire front matter is about this one car, across two
    // pages (その3 and その4, "オーテックバージョンK's MF-T" and "AJバージョン
    // K's MF-T"). Both print the plate as モデルナンバープレート車種記号
    // P 8 7 0 Z, against an AJ架装車種記号 of P 8 ■ 0 Z where ■ is G or M:
    // G is manual air conditioning plus 16-inch steel wheels, M adds the
    // triple cross bar. That G/M distinction lives in Autech's own coachwork
    // code and NOT on the plate, so the records cannot tell the two apart and
    // this does not pretend to.
    //
    // The volume dates it [9711- ]; the records start 1997-07, four months
    // earlier. The plate code matches exactly and uniquely, so the car is not
    // in doubt, but the adoption date on the page and the build dates in the
    // data disagree and that is left visible rather than reconciled.
    P870Z: "Autech Version K's MF-T",

    // 30 cars, all 1994-09. Carries the same trailing Z, and no ordinary S14
    // option combination ends that way, but volume 088 documents only the
    // MF-T and names nothing that fits this. Same treatment as the S15's YNZ:
    // the marker is reported because the records show it, the variant is not
    // named because the source does not name it.
    PR90Z: 'Autech special build (code PR90Z, not named in volume 088)'
  },

  _decodeS15Plate: function(modelId, mc, date) {
    const opts = [];
    const body = String(mc || '').replace(/[-\s]*S15\s*$/, '');
    const a = body.indexOf('S15');
    if (a < 0) return opts;
    const from = a + 3 + 3;

    const group = body.slice(from, from + 5);
    const autech = group.length === 5 && group[4] === 'Z'
      ? this._s15Autech[group.slice(0, 3)] : null;
    if (autech) {
      opts.push({ pos: from, platePos: this.platePos(from), char: group,
                  field: 'Autech', text: autech, verified: true });
      return opts;
    }

    for (let k = 0; k < 5; k++) {
      const pos = from + k;
      const ch = body[pos];
      if (ch === undefined) break;
      const table = this._s15Options[String(14 + k)] || {};
      const text = table[ch];
      // Each position has its own alphabet, so the same letter means different
      // things at 14 and at 18 — the table is picked by position, never shared.
      // A dash is the legend's own way of writing "no option here" and is in
      // the table as "standard", so it reports as decoded rather than unknown.
      opts.push({ pos: pos, platePos: this.platePos(pos), char: ch,
                  field: 'Option ' + (14 + k), text: text || null,
                  verified: !!text, undecoded: !text });
    }
    return opts;
  },

  _decodeZ32Plate: function(modelId, mc, date) {
    const opts = [];
    const L = this._z32Layout(mc);
    if (!L) return opts;
    let tail = L.body.slice(L.optionsFrom);
    let idx = L.optionsFrom;
    const d = String(date || '');

    // Pack first, off the end. Codes here are one OR two characters — E and F
    // are codes in their own right alongside E1..E8 and F1..F8 — so the longer
    // match is tried first and only a code the table actually holds is taken.
    let packTxt = null, packStr = null, packExact = true;
    const tabs = this._z32PackTables(L, d);
    for (let t = 0; t < tabs.length && !packStr; t++) {
      const tab = tabs[t];
      if (tail.length >= 2 && tab[tail.slice(-2)]) packStr = tail.slice(-2);
      else if (tail.length >= 1 && tab[tail.slice(-1)]) packStr = tail.slice(-1);
      if (packStr) { packTxt = tab[packStr]; packExact = (t === 0); }
    }
    if (packStr) tail = tail.slice(0, -packStr.length);

    // VS characters. The later window codes airbag combinations as two
    // characters (HT, DT, LT, RT, BT, TW, PT), so match greedily.
    const vs = (d && d >= '1992-08') ? this._z32Legend.vsLate : this._z32Legend.vsEarly;
    let p = 0;
    while (p < tail.length) {
      const two = tail.substr(p, 2);
      if (two.length === 2 && vs[two]) {
        opts.push({ pos: idx, platePos: this.platePos(idx), char: two, field: 'VS',
                    text: vs[two], verified: true });
        idx += 2; p += 2; continue;
      }
      const one = tail[p];
      opts.push({ pos: idx, platePos: this.platePos(idx), char: one, field: 'VS',
                  text: vs[one] || null, verified: !!vs[one], undecoded: !vs[one] });
      idx += 1; p += 1;
    }
    if (packStr) {
      opts.push({ pos: idx, platePos: this.platePos(idx), char: packStr, field: 'Pack',
                  text: packTxt, verified: packExact, reported: !packExact });
    }
    return opts;
  },

  _decodeOptions: function(modelId, mc, date) {
    const opts = [];
    if (!mc) return opts;
    if (this._r32Chassis.includes(modelId)) return this._decodeR32Plate(modelId, mc, date);
    if (this._s13Chassis.includes(modelId)) return this._decodeS13Plate(modelId, mc, date);
    if (this._z32Chassis.includes(modelId)) return this._decodeZ32Plate(modelId, mc, date);
    // S15 is its own shape: five option positions, each with its own alphabet,
    // rather than a VS run followed by a pack code.
    if (modelId === 'S15') return this._decodeS15Plate(modelId, mc, date);
    // A coachbuilt S14 carries one identifier across all five option slots,
    // so it is answered as one field before the per-position tables are asked
    // anything — see _s14Autech.
    if (modelId === 'S14' || modelId === 'CS14') {
      const grp = String(mc).slice(12, 17);
      const built = this._s14Autech[grp];
      if (built) {
        opts.push({ pos: 12, platePos: this.platePos(12), char: grp,
                    field: 'Autech', text: built, verified: true });
        return opts;
      }
    }
    if (this.layoutOf(mc) !== 'positional') return opts;
    if (this._optionalEquipmentChassis.includes(modelId)) {
      if (mc[10] === 'Z') opts.push({ pos: 10, platePos: this.platePos(10), char: 'Z',
        text: 'Cold Weather Package (Cold Area spec)', verified: true });
    }
    const gen = this._factoryOptionsGen[mc.slice(-3)];
    const table = this._factoryOptions && this._factoryOptions[gen];
    if (!table) return opts;
    const d = this._yymm(date);
    for (let p = 0; p < 5; p++) {
      const ch = mc[12 + p];
      if (!ch || ch === '-' || ch === ' ') continue;
      // Exact window match on the build date first, then the nearest window
      // that defines this letter at this position.
      //
      // The windows record when FASTOP was maintained, not when the car was
      // built, and they are narrower than production at both ends — the R33
      // table starts 9308 while R33 records start 1993-02. They are also not
      // contiguous in what they define: a letter can be defined at a position
      // in two windows and left out of the one in between, and an earlier
      // revision here only handled dates outside the whole span, so those cars
      // fell through to unnamed. That was most of the R33 shortfall — 1,026
      // records on position 0 letter B alone, 795 on 1:E, 633 on 2:A.
      // Measuring the distance to each window instead covers all four cases
      // (inside, between, before, after) with one rule.
      let hit = null, near = null, nearDist = Infinity;
      for (const e of table) {
        if (e.pos !== p || e.char !== ch) continue;
        const from = e.from < 8000 ? e.from + 10000 : e.from;
        const to = e.to < 8000 ? e.to + 10000 : e.to;
        if (d !== null && from <= d && d <= to) { hit = e; break; }
        if (d === null) { if (!near) near = e; continue; }
        const dist = d < from ? from - d : d - to;
        if (dist < nearDist) { nearDist = dist; near = e; }
      }
      const use = hit || near;
      // An exact window match is Nissan's own definition for that build date.
      // A nearest-window match is still Nissan's, but for a neighbouring date
      // range, and letters genuinely are redefined between windows — so it is
      // flagged rather than presented as confirmed.
      //
      // A miss is still shown: the character is genuinely stamped on the car,
      // and "position 15 reads B, meaning unconfirmed" is a more useful and
      // more honest answer than silently omitting the field.
      if (use) opts.push({ pos: 12 + p, platePos: this.platePos(12 + p), char: ch,
                           text: use.text, verified: !!hit, reported: !hit });
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
