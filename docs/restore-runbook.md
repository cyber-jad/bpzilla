# Restore runbook

What to hand a future AI assistant (or yourself) if this archive, or the FAST
data behind it, ever needs to be rebuilt. Read this before touching anything —
it names the traps that already cost real time once.

## The two things that must both exist

This is worth restating because `backup.ps1` says it too: the data can be
**rebuilt** only with BOTH of these present at once. Neither is sufficient
alone.

1. **This git repository** — the reasoning. Every option legend, every paint
   correction, every "this looked like a bug and wasn't" is in the commit
   history and in `docs/fast-volumes.md`. Losing this means starting the
   decode work over even with the discs in hand.
2. **The FAST discs, mounted at `H:\AR-JP\JP\`** (and `H:\AR-JP\AR\` for
   `FASTOPPE`) — the raw binaries: `VINDAT<n>.<vol>`, `MDLCODE.<vol>`,
   `FASTOP`, `SPECDSC.AA1`, `MAENOTE.NNN` / `MAEIMG.NNN` per volume. Without
   the repo these are just undocumented flat files — nothing on the discs
   documents its own format (see `docs/fast-volumes.md`'s note on
   `CDINDEX.XX1` and `E-FAST.mdb` both being dead ends).

## Scenario A — repo is fine, you just need to (re)run the pipeline

This is the normal case: adding a chassis, fixing a dropped character,
re-verifying after a change. Order matters.

1. **Mount the discs at `H:`.** Everything below assumes `H:\AR-JP\JP\...`
   exists and is readable.
2. **Re-derive, don't hand-edit.** Every extractor in the repo root
   (`extract_vindat.js`, `add_r32_engine.js`, `add_hr31_engine.js`,
   `add_body_field.js`, `extract_factory_options.js`, etc.) reads straight
   from the FAST binaries and either writes a brand-new `fast_<chassis>.json`
   or augments an existing one. None of them accept hand-typed data. If you
   are ever tempted to hand-edit a `public/data/fast_*.json`, stop — write an
   extractor instead, so the next person can reproduce what you did.
3. **The core extractor is `extract_vindat.js`.** Its own header comment is
   the authoritative format spec (record layout, offsets, endianness) — read
   it before writing a new one. Usage:
   ```
   node extract_vindat.js --verify                   # re-derive every shipped chassis it knows and diff against the committed JSON
   node extract_vindat.js --chassis ECR32 --write     # extract one new chassis to public/data/fast_ecr32.json
   ```
   `--verify` is the trust mechanism: it proves the extractor by reproducing
   files that already shipped byte-for-byte before you use it to produce a
   file that hasn't. Never skip it after touching this file.
4. **Augmentation scripts follow one strict pattern** (`add_r32_engine.js`,
   `add_hr31_engine.js`, `add_body_field.js` are the examples to copy): they
   do NOT re-extract. They re-open the same raw `VINDAT`/`MDLCODE` files,
   match every row already in the shipped JSON back to source by
   `(block, serial, model code)`, recover exactly one additional character,
   append a new dictionary (`bd`/`ed`) plus a 7th row-array element, and
   **assert the first N existing columns are byte-identical to the
   pre-augmentation file before writing** — hard abort otherwise. Copy this
   pattern rather than writing a bespoke one-off; the assert is what makes it
   safe to run against production data.
5. **After adding or changing any chassis/model**, regenerate the derived
   catalogs — they are generated files, never hand-edited:
   ```
   node extract_models.js       # rebuilds public/data/models.json
   node generate_sitemap.js     # rebuilds public/sitemap.xml
   ```
6. **Wire a new chassis into the live site** (two edits, both in
   `public/js/database.js`):
   - add its prefix(es) to the `prefixes` array in `loadFastData`
   - add a `models{}` entry (id, chassisPrefix, name, years, engine, body,
     description) — a record with no model entry loads with nothing to
     display it under.
   Decode logic (grade/engine/body/transmission) goes in the relevant
   `_decode*` functions; see `_decodeR31Grade` for a full worked example
   including a grade split that depends on engine family and a documented
   "undecoded, deliberately left blank" case.
7. **Run the final integrity check**: `node audit_chassis.js` — reports every
   in-scope chassis accounted for, comparing the ARCHIVE (every
   `fast_*.json` on disk) against the SOURCE, not against what the site
   happens to load. This distinction matters — see the "audit widened" story
   in `docs/fast-volumes.md`; a site-scoped audit found 0 problems while
   524,691 real records sat unextracted.
8. **Before calling anything "verified", re-read `docs/fast-volumes.md` in
   full.** It documents every trap already hit once (see next section) so you
   don't re-discover them the hard way.

## Scenario B — repo is lost, discs are intact

1. Restore the repo first, from whichever of these exists:
   - `git clone` from GitHub (`origin`) or GitLab (`gitlab`) — see
     `git remote -v` output normally kept in sync; ask the user which is
     current.
   - a `.bundle` file from `bpzilla-backups/` (sibling directory to the repo,
     outside it): `git clone bpzilla-<stamp>.bundle bpzilla`, verify with
     `git log --oneline -1`, cross-check against the matching `.sha256`.
2. Once the repo is back, this is Scenario A: mount the discs, re-run
   `extract_vindat.js --verify` to confirm the extractor still reproduces
   every shipped file exactly against the discs you have.

## Scenario C — discs are lost, only the repo/backup survives

The `fast_*.json` files in `public/data` are then **the only copy in
existence** — they cannot be regenerated. Treat them as the primary asset:
restore the repo (Scenario B step 1) and stop; there is nothing further to
"restore" without the discs. This is the exact reason `backup.ps1` hashes
every file in `public/data` individually rather than trusting the bundle
alone — so a single corrupted JSON can be caught even in this scenario.

## Traps worth knowing before you start (read these or repeat them)

These cost real debugging time once each. All are written up at length in
`docs/fast-volumes.md`; this is the short version so you know what to search
for.

- **Silently dropped leading characters.** FAST's model-code export can start
  storage at a fixed anchor (often the engine or chassis letter), dropping 1+
  characters that sit BEFORE that anchor in the raw `MDLCODE` bytes — even
  though the full code, engine letter included, is still physically present a
  few bytes earlier at `ptr-1`, `ptr-2`, etc. Recovered by matching every
  shipped record back to raw bytes via `(block, serial, model code)`, never by
  guessing from context. Hit on R33/R34 body char, R32 HR32 engine, and R31
  HR31 engine (10,790 of 182,351 records — see `add_hr31_engine.js`).
- **The length-cancellation trap** ("phantom chassis"). A record scan that
  matches variable-length codes can find a false hit where a longer code (say
  `RS15`) at offset `p` and a shorter one (`S12`) at `p+1` land every
  downstream field on the identical byte — because the extra code character
  cancels against the extra offset. This invented two chassis that do not
  exist, `RS15` and `CS15` (their record-to-record gaps were multiples of the
  real chassis's stride, not their own — that's the tell). Guard: keep only
  offsets whose neighbouring records are also valid records; never accept a
  single isolated match.
- **A field being all-zero on one export is not proof it's unused.** GTS-R
  looked unrecoverable from FAST alone because the four tail bytes after the
  `MDLCODE` pointer are zero on every HR31 record. That's true and it doesn't
  mean the information doesn't exist elsewhere — it turned up in the model
  code itself, cross-referenced against external VIN anchors. Exhaust H:
  fully (every ABBREV/CATALOG/ILLNOTE/APPNAME/FASTN/PATCODE file, not just the
  obvious VINDAT/MDLCODE pair) and the web before concluding "not in FAST."
- **An eight-byte date field storing spaces, not zeros, for an open-ended
  window.** `FASTOP` validity is `YYMMYYMM`; a window with no end date stores
  the second half as four ASCII spaces. A generator that requires eight
  digits silently skips every such record with no error — this dropped the
  single newest option-window definition for R33, R34, S14, and WC34 all at
  once (216 of 678 definitions), and it looked exactly like "FASTOP just
  doesn't cover this era" until someone re-read the raw bytes.
- **A grade/trim character can mean different things across engine families
  sharing one chassis code.** The R31's Excel/Passage grade letters only get
  the marketing names GTS/GTS-X on the RB20 and RD28 legend rows — the CA18
  row has no such name — so a straight lookup mislabeled four-cylinder cars
  as "GTS". Always check whether the legend prints the mapping conditionally
  before generalizing it across every variant sharing the chassis suffix.
- **A coachbuilt/Autech variant still carries its donor car's grade
  character.** Testing the plain grade letter before checking the
  coachbuilder's own option group hides it entirely (happened identically on
  both S14 and S15 — see the "grade branch order" fix in `database.js`).
  Always check the coachbuilder/special-build group FIRST, the base grade
  second.
- **`platePos = mcIndex + 2`**, verified against real photographed plates —
  don't assume 1:1 or +1 indexing between the stored model-code array and the
  physical plate position without checking a real plate.
- **When two sources disagree on a color/option name, the glossary
  (`SPECDSC.AA1`) is the authority over a page-image transcription**, because
  it is the more complete of the two (example: STTMQ is genuinely
  `INTERIOR(ORANGE OR BLUE)`, ambiguous by design, not a transcription choice
  between two different colors on two different plates).
- **A `--verify` or audit tool is not automatically correct just because it's
  the one measuring the data.** Two real bugs this session were in verification
  scripts, not the data itself: comparing against the wrong chassis stamp for
  a shared physical file, and checking for a field name (`id`) that the
  target JSON never used. When a check reports a problem, confirm the checker
  is asking the right question before trusting the result.

## Chain of custody for a claim like "823 GTS-R"

Worth recording as a template for any future car-identity puzzle like this:
neither FAST alone nor the web alone was enough. FAST gave the candidate
model codes and confirmed the exact count and date window; independently
sourced VIN anchors (prototype and first-production chassis numbers, from a
now-defunct dedicated registry site, quoted directly by a person who'd
researched it) pinned which codes were the real answer versus a same-looking
neighbor code. See `r31-gtsr-identification.md` in the memory store, and
`docs/fast-volumes.md`'s R31 section, for the full worked chain. The general
lesson: exhaust H: fully AND search the web before concluding a per-vehicle
distinction "isn't in the data" — the combination is sometimes strictly more
powerful than either source, even though each alone looked like a dead end.
