# FAST volume map

Which numbered volume under `H:\AR-JP\JP\` documents which chassis.

This is not written down anywhere on the discs. `CDINDEX.XX1` is the stub string
`DUMMY`, and `E-FAST.mdb` turned out to be a VBA project shell whose `MODEL` and
`MAEGAKI` tables hold no rows. The map below was recovered by rendering the first
front-matter page of all 179 volumes that have one and reading the drawing number
in the bottom-right corner, which ends in the chassis code — `AJDMC10R32`,
`AJDMB10S14`, `AJDMC10Z32`. Four of those (079 R32, 080 R33, 081 R34, 086 S12)
were independently confirmed from their page contents beforehand, which is what
makes the rest trustworthy.

Recover it again, if ever needed, with `fast_image.js`: decode page 1 of each
volume's `MAEIMG.NNN` at width 1280 and crop x 1020-1280 of the last ~30 rows.

## Why these volumes matter

Each volume's front matter (`MAENOTE.NNN` indexes it, `MAEIMG.NNN` holds the
images) carries 「モデル記号の意味」 and 「モデル記号の意味（オプション記号）」 — Nissan's own
legend for the model code stamped in the MODEL column of the model number plate.
That is the field this site decodes. FASTOP only covers a handful of chassis and
only within the windows it was maintained to; these legends cover everything and
are the authority where the two disagree.

## Chassis this site holds

R30, R31 and the M35 Stagea are listed here because their data files exist and
are kept, but they are out of scope for the site and not loaded. The files stay
in `public/data` — there is no extractor in this repo, so the export is the only
copy short of re-deriving it from the FAST binaries.

| chassis | volume | front-matter pages | records | option decode |
|---|---|---|---|---|
| R30 Skyline  | 077 | 16 | 437,803 | extracted (8 codes), not loaded |
| R31 Skyline  | 078 | 36 | 285,676 | extracted (5 codes), not loaded |
| R32          | 079 | 27 | 295,861 | done, from this legend |
| R33          | 080 |  2 | 180,398 | done, FASTOP incl. [9710- ] |
| R34          | 081 | 11 |  67,040 | done, FASTOP incl. [200008- ] |
| RS13 / RPS13 | 084 | 17 | 113,305 | done, all five windows |
| S13          | 087 | 18 | 165,866 | done, from this legend |
| PS13 / KS13  | 087 | —  | 136,777 | done, from this legend |
| S14          | 088 |  3 |  84,826 | 96.1% — FASTOP all three windows |
| S15          | 089 | 10 |  39,138 | done, from this legend |
| WC34 (Stagea)| 110 | 3  | 133,408 | done, FASTOP incl. [9808- ] |
| Z32          | 132 | 12 | 162,666 | done, all five pack windows |
| M35 Stagea   | 153 | 22 |  58,489 | extracted (5 codes), not loaded |
| S110 Silvia  | 085 | —  |  73,184 | extracted, not loaded |
| S12 Silvia   | 086 |  2 |  28,170 | extracted, not loaded |
| Z31 300ZX    | 131 | —  |  35,381 | extracted, not loaded |
| AM35 (Autech)| 163 |  — |       — | Autech variant of M35 |

Note on S13: volumes 087 and 084 together cover the whole family, 415,946
records across five files. The four Silvia files no longer share one model-code
dictionary — each was re-extracted with only the codes its own rows use, which
is why fast_ks13.json shrank from 0.62 MB to 0.48.

## Neighbouring volumes, for orientation

Volumes 001-116 run alphabetically by chassis code, which is why the Skylines sit
together at 077-081 and the Silvias at 084-089. Later blocks (124+) are the 2000s
models and are not alphabetical relative to the first block.

```
056 K30   057 K30S  058 KN13  059 M10   060 M11   061 M12   062 M30
063 N12   064 N13   065 N13P  066 N14   067 N15   068 N30   071 P11
072 P11F  073 PK10  075 R11   077 R30   078 R31   079 R32   080 R33
081 R34   082 R50   083 RB14  084 RS13  086 S12   087 S13   088 S14
089 S15   091 SY31  092 T11   093 T12   094 T12Y  095 TC22  096 U11
097 U12   098 U13   099 U14   100 U30   101 V10   102 VR11  103 VE24
104 W10   105 W11   106 W30   107 W40   108 W41   109 WA32  110 WC34
111 WD21  112 WF24  113 WP11  114 WU12  115 WY30  116 Y10   124 Y30
125 Y31   128 Y60   129 Y61   130 Z10   131 Z31   132 Z32   134 Y11
135 Y34   136 C24   138 S21   139 VW11  141 JU30  142 WK11  143 FA0
145 G10   147 T30   148 F50   149 P12   150 E25   152 V35   153 M35
154 K12   155 SA0   156 E51   157 Z33   159 Z11   160 J31   162 U31
163 AM35  166 PF50  167 GZ1   169 MA0   176 Z50   177 C11   215 R35
```

## R31 (volume 078) — work in progress

The VS記号 table is complete and verified. The パック記号 tables are not.

**VS記号** (page 2), and it accounts for every VS character in all 182,351
records with nothing left over:

| code | meaning | records |
|---|---|---|
| D | electric retractable door mirrors | 86,297 |
| I | manual folding door mirrors | 60,016 |
| L | electric retractable door mirrors + projector headlamps | 29,325 |
| Z | cold region | 11,773 |
| M | manual folding door mirrors + projector headlamps | 5,259 |
| B | fender mirrors | 1,397 |
| P | asymmetric mirrors | 56 |

**Model code**: `[車体形状][エンジン][サスペンション] R31 [ドア][車両仕様][変速機][燃料装置][VS記号][パック記号]`,
with 車体形状 the character the export drops. 車両仕様 is H/Y/G/V/J, 変速機 F/A,
燃料装置 blank/E/T/S. The tail is one to two VS characters then a
two-character pack code.

**What is done**: pages 2-9, the sedan / 4-door hardtop / wagon pack tables
for [8508-8708]. Extracted to `docs/wip/r31-packs-8508-8708.json`, machine-read
with fast_matrix.js. Covers 40.7% of records.

**One thing that looked like a contradiction and was not.** Code WS is defined
twice, on page 6 (sunroof, urethane 2-spoke wheel, 195/60R15 alloys) and again
on page 8 (power steering, premium stereo, 4-speaker radio, foot selector) —
same window, same body styles. The pages carry the note 「パック記号 HL〜WX は、
86年9月以降より追加されます」, and the records settle it: WS runs 1985-03 to
1985-11, then stops completely, then resumes 1986-10 to 1987-07. The code was
retired and reissued with a new meaning. So the [8508-8708] window is really
two, split at 1986-09, and the JSON above is keyed E / L accordingly.

**What remains**, and why it is not wired in yet:

- Pages 14-21 are the [8708-8904] tables. Our R31 records run to 1989-04, so
  these hold the codes behind most of the unnamed packs — PG (14,207 records),
  P5 (7,958), XF (5,378), P3 (4,755), Z4 (2,921), CU (2,722), XM, Z1, XX.
- Pages 22-25 are a separate 2ドア スポーツクーペ set (KA-KP, KR-W3), which is
  where the unnamed KJ, KQ and LG come from.
- That second point is the blocker. The later pages are organised by GRADE
  COLUMN (RB20E GTパサージュ, RB20ET GT, GTS) and by body style, so the pack code
  alone no longer identifies the equipment — body style has to be read from the
  model code first. The current parser does not separate 2-door from sedan, and
  applying a sedan table to a coupe would be wrong rather than merely missing.
  That axis needs handling before any of this goes live.

## Z32 (volume 132) — complete

All five pack windows are read. 99.92% of the 64,866 JDM Z32 records now
decode every option character, against 87.0% before.

**Model code**, from pages 1-3, which give three windows:

```
[ルーフ][エンジン][シーター] Z32 [車格][変速機][過給][VS記号][パック記号]
ルーフ    スペース 標準ルーフ / K Tバールーフ / C コンバーチブル (from 9208)
エンジン   R VG30DE系      シーター  スペース 2シーター / G 2+2シーター
車格      J GL/VS / T VR / X ZX
変速機    スペース MT / A AT      過給  スペース ノンターボ / S ツインターボ
```

**車格 is not just J.** Page 1 lists only J and this archive read only J for a
long time, which is right for windows 1-3 — they are 100% J. Page 3, the
[9810- ] diagram, adds T for VR and X for ZX. Missing them was not a small
omission: with X unrecognised the parser advanced nothing, so XAS70 had its
X, A and S all read as VS characters, making the grade, the gearbox and the
turbo flag each wrong at once. 717 records, nearly all of [9810- ].

**VS記号** (page 4), two windows, the later using two-character codes:

```
[8907-9208]  B BOSE audio · H 4WAS/ABS · P BOSE + leather · W leather · Z cold region
[9208-    ]  H ABS · D ABS+BOSE · L ABS+leather · R ABS+BOSE+leather
             HT / DT / LT / RT are those four plus airbag
             B BOSE · W leather · P BOSE+leather · T airbag · BT · TW · PT · Z cold region
```

**Pack windows**: [8907-9309] pages 5-6, [9309-9410] page 7, [9410-9701] pages
8-9, [9701-9810] page 10, [9810- ] pages 11-12. Five, more than any other
chassis here. Read by extract_z32_packs.js, which transcribes the row labels
and column codes by eye and lets fast_matrix.js find the marks, then refuses to
write unless the machine-read grid matches the transcription exactly.

**What each window keys on differs**, which is the part worth knowing:

- [8907-9309] keys by 車型タイプ AND トランスミッション — the same code means
  different equipment on MT and AT.
- [9309-9410] keys by 車型タイプ only. Its transmission header spans MT and AT
  together, so a code means the same on both.
- The last three key on nothing but the code.

**Boundary months contain both.** Of the 128 cars built in 1993-09, 100 carry a
code from the window opening that month and 28 from the one closing it; 1994-10
splits 72 to 54. There is no cutoff that is simply right, so the window owning
the date is tried first and its match is verified, while a match found in
another window is reported rather than confirmed. That accounts for 0.1% of
characters.

**Still open.** 83 option characters across 64,866 records remain unnamed, and
the convertible is a permanent blind spot: its codes are known (16, 17, 97) but
the roof character is the one the FAST export drops, so a convertible cannot be
told from a coupe. CONV is consulted only after the body-typed table fails.
One transcription oddity is recorded rather than corrected: page 10 prints
フロス where the equivalent row two windows earlier prints クロス, checked at 3x
against page 8 in the same font.

## 180SX (volume 084) — complete

The site had only the first of five windows, which is the CA18 RS13 car and
stops in November 1990. RPS13, the SR20 180SX, is 86,565 records and three
quarters of all 180SX production, and its four later windows had never been
read. It decoded 23.3% of records when first added; it now decodes 98.0%.

| pages | contents |
|---|---|
| 1-3 | layout diagrams for [8903-9101], [9101-9201], [9201- ] |
| 4-6 | パック記号 [8903-9101] — the RS table the site already had |
| 7-9 | パック記号 [9101-9201] |
| 10 | VS記号 and パーソナルオーダーコード for [9101-9201] |
| 11-12 | パック記号 [9201-9608] |
| 13 | VS記号 and パーソナルオーダーコード for [9201- ] |
| 14 | パック記号 [9608-9710] |
| 15-16 | パック記号 [9710- ] |
| 17 | grade specification table, not packs |

**Two VS characters were most of the gap.** Page 13 names them: G is
TYPE III / TYPE X and H is ABS. G alone appears on 53,786 records and H on
6,470, and both had decoded to nothing — "GM" is the most common option string
this chassis has, 27,380 cars. Both went into the shared VS table safely
because they appear on RPS13 and on no other chassis in the family: zero
occurrences across S13, PS13, KS13 and RS13, checked before adding.

**The windows are not the Silvia's.** `_s13Window` splits at 9101, 9201 and
9205; the 180SX splits at 9101, 9201, 9608 and 9710. Same legend file,
different car. The codes genuinely collide across those windows — 10, 11, 12,
16 and 17 all appear in both [9101-9201] and [9201-9608] with different
equipment, and 50 appears in three — so a flat table would be wrong for most
of the car's life. See `_rs13Window`.

**A field confirmed absent rather than assumed.** The layouts show a
パーソナルオーダーコード after the pack code: three digits, each 0 or 2, keying
leather seats, leather steering wheel and fender mirrors. No record in the
archive carries it, so the export does not include it.

**Nothing remains.** The 1,876 characters that looked like unknown VS codes —
A (714), 5 (615), then 7, 6, D, 1, F — were not VS codes at all. They were
halves of pack codes the splitter refused to split: it required two DIGITS,
and the later 180SX packs are alphanumeric (5A, 5B, 5C, 5D, 6A-6D, B1-B7,
8A-8H, 9A-9H). Tails like G5A and H9A are G or H followed by pack 5A or 9A.
The tables had those codes all along. The splitter now asks the tables whether
the last two characters are a pack, falling back to the digit pair, and the
whole S13 family reads 100% of records with every character named.

Volume 087 pages 4 and 5 were checked while looking for these and hold only
codes the site already had — the [8805-9101], [9101-9201] and [9201- ] VS
tables for the Silvia.

## S14 — it was never blocked; the extractor was dropping windows

This section used to say the S14 was blocked at source. It was wrong, and how
it was wrong is worth more than the conclusion was.

The claim was: **"FASTOP is the only legend S14 has, and it ends at 9606"** —
and it noted, in its own defence, that this had been checked against the raw
`H:\AR-JP\JP\FASTOP` rather than the extracted JSON. FASTOP does not end at
9606. It *opens* a window there: `9606-`, open-ended, 67 codes across all five
positions, covering every S14 built from the 1996 facelift to the end of
production.

It was invisible because of how an open window is stored. The validity field is
eight bytes, `YYMMYYMM`; when a window has no end date the second half is four
SPACES, not zeros. The generator required eight digits, so every open-ended
record failed its shape test and was skipped without complaint. Every
generation FASTOP covers has exactly one such window — its last:

| chassis | in FASTOP | shipped before | dropped window |
|---|---|---|---|
| R33  | 313 | 258 | `9710-`   |
| R34  | 119 |  58 | `200008-` |
| S14  | 137 |  70 | `9606-`   |
| WC34 | 109 |  76 | `9808-`   |

216 of 678 definitions, and always the newest cars in each family.

Two smaller traps sat alongside it. The description text is 35 bytes, not the
39 the record's remaining width suggests: bytes 35-36 are a flag field carrying
`AB` on airbag entries, and reading them as text produces strings like
`ABS         AB` and `ﾌｪﾝﾀﾞABｰﾐﾗｰ` — a two-letter code spliced into the middle
of a word. And the sixth mask byte is not a line counter: digits are
continuation lines of the description, but *letters* are a different column
entirely, the grade the option applies to, which is how `ｴｱｺﾝﾚｽ` becomes
`ｴｱｺﾝﾚｽ's標準仕様`.

The R34 shows the cost twice over. That dropped `200008-` window had been
re-created by hand, page by page, from volume 081 — work that existed only
because the data was believed missing. The two readings agree, which is the one
good thing to come of it: FASTOP defines all 50 codes the hand table had, plus
11 it had missed, and corrects `16桁目 P` from "front and rear strut tower
bars" to `FRストラットタワーバー`, a *front* strut tower bar for the 25GT-V.

**Result.** Archive option coverage went from 99.233% to 99.606%, and undecoded
characters from 24,728 to 12,709. S14 went from 91.32% to 96.09%, CS14 from
96.10% to 99.92%. By S14 build year, 1996 went from 91.66% to 99.98%.

**What still remains on S14** is about 9,164 characters, most of them 1994
cars, and that part *is* source thinness rather than a parser fault: the
`9310-9505` window defines only two codes at plate 15 and none at all at plate
17, where `9505-9606` defines nine and three. Cars built before May 1995 have
positions their own window never described.

**Volume 088 genuinely does not help**, and that part of the old note stands.
It is three pages and all three are the Autech Version K's MF-T: a list of its
model codes (`P80GZ`, `P80MZ`, `P870Z` at positions 14-18) and two pages of
symbol explanation for that one variant. There is no general S14 モデル記号
legend in the volume — unlike the R32, Z32 and 180SX volumes, which is what
made those closable. None of the three Autech codes appears in the records.

**SPECDSC.AA1 gives vocabulary but not the mapping.** Nissan's own option
glossary holds 27 S14 tokens — `ACONWS14` "W/O AIR CON", `DIFF6S14` "F/VISCOUS
LSD", `GLSSWS14` "F/PRIVACY GLASS", `AUTC2S14` "F/AUTECH JAPAN VERSION". That
names the equipment but not which model-code character selects it, so it
confirms a reading rather than producing one.

**One hypothesis tested and rejected.** S14 codes end in a three-character
group and the 180SX carries a パーソナルオーダーコード in exactly that
position, so the same was suspected here. It is not: only 966 records end in
three digits against 83,860 that do not, and the common endings are `D4C`,
`L-A`, `C-B` — option characters with dash filler, not an order code.

The re-reader is `extract_factory_options.js`. It refuses to write a file
smaller than the one already shipped, or one that loses a definition the
shipped file had, and it never retranslates an entry that already shipped.

## The archive is now complete against the source

`audit_chassis.js` reports **65 of 65 in-scope chassis accounted for, 0 not
extracted, 0 differing**. Getting there meant widening the audit itself, and
that is the part worth remembering.

The tool used to compare the source against what the SITE loads. That was fine
while those were the same thing and stopped being fine the moment families
were extracted but deliberately not served — against a site-scoped baseline
every one of them reads as missing data when the data is on disk. It now
compares against the ARCHIVE, every `fast_*.json` in `public/data`, and
reports served/held as a separate column.

Widening the generation list at the same time immediately found **524,691
records that had never been extracted at all**, in generations nobody had
asked about:

| family | had | was missing |
|---|---|---|
| R30 Skyline | `DR30` only | `HR30` 185,975 · `FJR30` 108,676 · `PJR30` 34,115 · `VPJR30` 31,375 · `ER30` 15,156 · `VSJR30` 11,595 · `UJR30` 6,472 |
| R31 Skyline | `HR31` only | `FJR31` 73,692 · `WFJR31` 14,921 · `SR31` 12,524 · `WHJR31` 2,188 |
| M35 Stagea | 4 variant codes | `M35` 28,002, the base code and the largest of the five |

This is the same blind spot that once hid the entire S15: an audit scoped to
what you already have finds omissions, not absences. All twelve are now
extracted. `VPJR30` and `VSJR30` run to 1989-10, four years past the saloon,
which is correct — the Skyline Van outlived the R30 range.

### The colour-trim character, and a finding not acted on

Adding `DR30` and `HR31` to `--verify` produced a mismatch on exactly 7,218
and 43,988 rows — precisely their non-blank counts at `[L+6]`. Those two files
DROP the character; the first attempt kept it.

Checking which is right turned up something broader: **the byte is not empty on
the families that discard it.** Measured across the source:

| | at `[L+6]` |
|---|---|
| dropped | HCR32 138,676 non-blank · HR33 63,726 (all `K`) · ER34 37,266 (none blank) · BNR32 25,971 |
| kept | S13 146,681 · S15 39,138 (none blank) |

So the rule is by family — Skylines discard it, Silvia/Z/Stagea keep it — not
by whether anything is there. R30 and R31 therefore drop it, matching every
other Skyline and matching the two files already on disk, which is what lets
`--verify` check this extractor against a tool written independently of it:
**13/13 exact, including those two.**

That the Skylines discard a real character on 240,000+ records is recorded
here and deliberately NOT changed. Fixing it would rewrite files the site
serves and change what a plate displays, which is a different job.

### Held, not served

30 chassis, 918,703 records: R30 437,803 · R31 285,676 · S110 73,184 ·
M35 58,489 · Z31 35,381 · S12 28,170. Every one is decoded and checkable and
none is wired into the site. Serving any needs two edits — the prefix in
`database.js` and a `models{}` entry — and that is a scope decision, not a
data one.

## Held but not served: S110, S12, Z31

136,735 records across twelve files, extracted so the data exists and can be
checked, and deliberately not added to the site. Same arrangement as the M35
Stagea: the files sit in `public/data` and the loader's `prefixes` list in
`database.js` does not name them. Serving any of them needs two edits, the
prefix here and a `models{}` entry — records without a model entry load with
nothing to display them under.

| family | codes | records | build dates |
|---|---|---|---|
| S110 Silvia | `S110` 61,407 · `PS110` 8,586 · `US110` 3,191 | 73,184 | 1980-07 .. 1983-07 |
| S12 Silvia  | `S12` 14,134 · `JS12` 11,170 · `US12` 2,866 | 28,170 | 1982-11 .. 1988-03 |
| Z31 300ZX   | `GZ31` 11,965 · `HGZ31` 9,560 · `PGZ31` 6,998 · `HZ31` 3,046 · `PZ31` 1,981 · `Z31` 1,831 | 35,381 | 1982-12 .. 1989-05 |

All three live in the AB3 volume set, spread across `VINDAT3`, `VINDAT4` and
`VINDAT5`. The codes were found by walking every VINDAT file and tallying what
is actually there rather than looking up an expected list — 970 distinct codes
across the disc set — which is what caught the two entries below.

**Two phantoms rejected.** `RS12` validates twice at a run boundary in
VINDAT4.AB3 and is not a chassis: a 4-character `RS12` at p and a 3-character
`S12` at p+1 put every field on the same byte, the length-cancellation trap
that once invented RS15 and CS15, and two records cannot satisfy the
contiguity rule that would otherwise settle it. Dropping them gives 28,170,
which is what an independent count of this family had already produced.
`PS110` also appears in VINDAT5.AB1 with 14 records — dated 1995, when the
S110 ended in 1983, in a different file from the real run, and carrying a
four-character paint code where this family uses three. Three independent
signals, all pointing the same way; only the 8,586 records in VINDAT5.AB3 are
kept.

**One oddity kept.** Ten of the 61,407 S110 records carry 1995 build dates
inside the single contiguous run. They are structurally ordinary records in
the middle of a real run, so they are almost certainly a transcription slip in
the source rather than a decode error, and removing records because their date
is surprising is how real data gets lost. 0.016% of the family.

**The colour-trim character is kept for all three**, counted rather than
assumed — the mistake that once took a character off every paint code in the
S13 family. Every one of the twelve codes carries a real character at
`[L+6]` on a meaningful share of records (K, B, G, C, A, T, F), from 475 of
8,586 on PS110 up to 6,755 of 11,965 on GZ31.

## What is left undecoded, and what has already been ruled out

12,709 option characters across the whole archive, 0.394% of the 3,223,521 the
decoders claim. Shape of the residue:

| | |
|---|---|
| digits | 9,144 |
| single letters | 3,252 |
| two-character pack codes | 313 |
| in a record whose other positions decoded | 11,341 |
| in a record where nothing decoded | 1,368 |

Concentrated at plates 15-18 (11,821 of 12,709) and led by `0` (3,661), `1`
(2,426), `Y` (1,510) and `Z` (1,059).

**`0` is not an option code anywhere in FASTOP.** The option alphabet is 1-9
and A-Z with I and O skipped — the usual avoidance of characters that read as
1 and 0 — and across all 8,203 definitions for all 53 chassis, `0` is never
assigned at any of the five positions.

**It is not filler either, and that was tested rather than assumed.** The
obvious reading is that `0` plays the role `-` plays and means "nothing fitted
here", which would close 29% of the residue with one line. It does not survive
contact with the records: 25 of the 27 chassis/positions where `0` appears use
`-` heavily *as well*, and in most of them `0` turns up in single digits — 5
records on BCNR33 plate 16, 1 on HR33 plate 15, 2 on ER34 plate 15 — against
tens of thousands of dashes. A position does not have two fillers. Those look
like bad records rather than a code.

The exception is the S14, which carries 2,157 zeros at plate 15, 1,013 at 16
and 315 at 17, alongside 37,135 dashes at plate 15. Three and a half thousand
is too many to dismiss as noise and it is not explained yet. Whatever it is, it
is specific to the S14 rather than a property of the format.

**`H:\AR-JP\AR\FASTOPPE`, the second FASTOP file, does not help** and is now
checked off: 17 chassis, all export or later models — `P11E`, `V36`, `J10E`,
`Y31`, `E24`, `A33`, `CD22`, `K12E` — with no overlap with anything this site
covers.

`Y` and `Z` at plate 18 (2,529 together) are defined by FASTOP at that position
for other chassis but never for the ones that carry them here, so they are an
ordinary table gap rather than a structural puzzle.

## S15 (volume 089) — complete, and it was missing entirely

The S15 Silvia was not in this archive at all: 39,138 records, the last Silvia
and the last S-chassis, sitting in `VINDAT3.AB3` untouched.

**Why the audit did not catch it.** `audit_chassis.js` was scoped to the
generations the site already held. A generation that had never been added
cannot show up as absent from an audit that only asks "is what we have
complete". It surfaced because someone asked for it by name. S15 is in `GENS`
now, but the lesson generalises: an audit scoped to what you already know finds
omissions, not blind spots.

**Two counting bugs, both the same class as the R34 one.**

The record walk rejected any match preceded by a letter — a guard against "R32"
matching inside "ECR32". That holds only while record tails are zero. S15's are
not: one ends `00 00 12 52`, and `0x52` is `R`, so the *next* record was
discarded for being preceded by a letter while a phantom `RS15` matched one byte
earlier and read the identical fields, because the extra code character cancels
against the extra offset. That cost 4,912 records and invented two chassis codes,
**RS15** (2,581) and **CS15** (116), which do not exist. Their gaps give them
away: multiples of 29, the S15 stride, not their own 30. `findRecords` now keeps
only offsets whose neighbours are records.

And the two-digit year was read as 1900s, cutting the car off at 1999-12 when it
ran to 2002-08 — 20,476 of its records are years 00, 01 and 02.

**The layout is positional**, unlike the S13 family:

```
[1 車体形状 G クーペ][2-3 エンジン BY SR20DE][4 アクスル A 2WS / B 4WS]
[5 R 右ハンドル][6 グレード T S / U S-AERO,R][7 変速機 F MT5 / Y MT6 / A AT4]
S15 [11 燃料装置 E EGI / U ターボ][12 仕向地 D 標準地 / Z 寒冷地]
[13 特装 4 標準][14-18 オプションコード]
```

**The grade character is a bundle, not a trim.** Position 6 reads `T` = S and
`U` = "S-AERO, R" — the volume itself puts two things in one slot. A footnote
on the same page widens it further:

> （注）S/AEROグレードには、spec SのGパッケージ・bパッケージ・
> Lパッケージ・Vパッケージ及びSエアロを含みます。

"The S/AERO grade includes spec S's G, b, L and V packages, and S Aero." The
second is printed lowercase on the page. So `U` covers Spec-R, Spec-R Aero,
S Aero and four named packages, and reading it as one trim collapsed all of
them into a single wrong label.

Two things in the option data pull them back apart, and they rest on different
authorities, which is why the code tests the two engines differently.

*The aero body*, at position 14. If it were freely orderable, base Spec-S cars
would carry it. **Not one of the 1,290 does** — it appears only on `U` cars.
That is a grade-linked body, not an option.

*The trim treatments*, also at position 14. Base Spec-S is startlingly bare —
every one of its 1,290 cars is "rear wiper" or "rear wiper + rear fog lamp" and
nothing else. So any leather, silver interior or suede is above the base car.
On the NA side the footnote settles what those are outright: S/AERO minus S
Aero **is** the packages. On the turbo side nothing states it, so the trim
treatment does the work — and it works because the treatments appear on both
engines, in the same option letters:

| treatment | NA (Spec-S) | turbo (Spec-R) |
|---|---|---|
| leather, blue stitching + interior (orange or blue) | 1,331 | 1,100 |
| silver interior + silver steering wheel | 836 | 699 |
| punched suede | 957 | 2,849 |
| leather, red stitching | 5,654 | — |

The packages were never Spec-S only. Treating them that way hid 4,649 Spec-R
package cars inside a plain "Spec-R".

| grade | cars |
|---|---|
| Spec-R | 10,203 |
| Spec-S package (G/b/L/V) | 8,781 |
| Spec-R Aero | 6,032 |
| Spec-S Aero | 4,689 |
| Spec-R package (G/b/L/V) | 4,649 |
| Autech Version | 1,875 |
| Spec-S | 1,290 |
| Varietta | 1,088 |
| Autech special build | 477 |
| Style-A | 54 |

**The interior colour is not in the record.** `STTMQ` is the token, and the
disc's own glossary describes it twice for the S15 — `F/BLUE INTERIOR` and
`F/INTERIOR(ORANGE OR BLUE)`. The second is the honest one: orange and blue
share a single option code, so no record can say which a given car got. This
archive had the token transcribed as "blue interior" at plate 14 and "interior
package, orange" at plate 18 — one token, split into two colours it cannot
distinguish, which read as two different options on the same car. Both now say
orange or blue. The lesson is the ordinary one: the page transcription was a
reading, and `SPECDSC` had the answer keyed by token and chassis all along.

**What is deliberately not claimed.** Nothing names which car is a G rather
than an L. No option position carries a package name, and FASTOP has no S15 at
all — it stops before the car existed. There is a tempting near-fit, four trim
treatments on the NA side against four package names, and the red-stitch
treatment being absent from plain turbo cars would even explain a package that
was S-only. It stays an observation. Assigning the letters on the strength of
the counts matching would be invention, so the packages are shown as a bucket.


**Five option positions, each with its own alphabet** (pages 3-6), and the
letters skip I and O throughout. A dash means standard, which is why so many
plates read `C--A-`. Position 14 has 24 letters, position 15 has five.

**The Autech cars are identified by option group, not chassis code** (page 1),
which is why looking for an "Autech S15" among the chassis codes finds nothing.
`PB4`/`PB6` is the Autech Version 6MT, `UA3`/`UA4` the Varietta, `TKA`/`TK1`/
`TKB`/`TK2` the Style-A, `LVT` the Driving Helper — all with `Z` at position 18,
a value the ordinary position-18 table does not contain. The archive holds
**1,875 Autech Version, 1,088 Varietta and 54 Style-A**. No Driving Helper.

**One paint code has no disc behind it.** BN5, on 237 records, is in none of the
196 ABBREV colour tables. Enthusiast sources call it Light Bluish Silver (some
say Aqua Silver), so it is in OVERRIDES marked as corroborated rather than
sourced — the same footing as the R33 two-tones 1N3 and 1N4.

**Decode**: 98.8% of records have every option character named.
