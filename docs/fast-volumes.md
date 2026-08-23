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
| R30 (DR30)   | 077 | 16 | 44,439  | none yet |
| R31 (HR31)   | 078 | 36 | 182,351 | none yet |
| R32          | 079 | 27 | 295,861 | done, from this legend |
| R33          | 080 |  2 | 180,398 | done, from FASTOP |
| R34          | 081 | 11 |  67,040 | done, FASTOP + this legend's second window |
| RS13 / RPS13 | 084 | 17 | 113,305 | done, all five windows |
| S13          | 087 | 18 | 165,866 | done, from this legend |
| PS13 / KS13  | 087 | —  | 136,777 | done, from this legend |
| S14          | 088 |  3 |  84,826 | partial — FASTOP stops at 9606 |
| S15          | 089 | 10 |  39,138 | done, from this legend |
| WC34 (Stagea)| 110 | 3  | 133,408 | done, from FASTOP |
| Z32          | 132 | 12 | 162,666 | done, all five pack windows |
| M35          | 153 | 22 |  30,487 | out of scope — not loaded |
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

## S14 (volume 088) — blocked, and worth writing down why

S14 decodes every option character on 83.5% of its records. The missing
sixth is not spread evenly: by year it runs 1993 99%, 1994 92%, 1995 100%,
then 1996 66%, 1997 50%, 1998 26%. Something stops in 1996, and it is the
source, not the parser.

**FASTOP is the only legend S14 has, and it ends at 9606.** Its windows are
`9310-9505` and `9505-9606` — nothing after June 1996, which is exactly where
the decode falls away. For comparison, the same file carries five windows for
R33 running to 9710 and three for WC34 running to 9808. This was checked
against the raw `H:\AR-JP\JP\FASTOP` rather than the extracted JSON: the
extractor missed nothing, the data is not there.

**Volume 088's front matter does not help.** It is three pages, not the
fifteen this table used to claim, and all three are the Autech Version K's
MF-T: a list of its model codes (`P80GZ`, `P80MZ`, `P870Z` at positions
14-18) and two pages of symbol explanation for that one variant. There is no
general S14 モデル記号 legend in the volume at all — unlike the R32, Z32 and
180SX volumes, which is what made those closable. None of the three Autech
codes appears in the S14 or CS14 records.

**SPECDSC.AA1 gives vocabulary but not the mapping.** Nissan's own option
glossary holds 27 S14 tokens — `ACONWS14` "W/O AIR CON", `DIFF6S14`
"F/VISCOUS LSD", `GLSSWS14` "F/PRIVACY GLASS", `AUTC2S14` "F/AUTECH JAPAN
VERSION" and so on. That names the equipment but not which model-code
character selects it, so it cannot close the gap on its own. It would be
useful for confirming a reading obtained some other way.

**One hypothesis tested and rejected.** S14 codes end in a three-character
group and the 180SX turned out to carry a パーソナルオーダーコード in exactly
that position, so the same was suspected here. It is not: only 966 records end
in three digits against 83,860 that do not, and the common endings are `D4C`,
`L-A`, `C-B` — option characters with dash filler, not an order code.

**What remains unnamed**: 20,799 character occurrences, led by `T` (6,397),
`0` (3,489), `1` (2,274), `Y` (1,315) and `U` (1,207). Closing it needs an
S14 legend for the 1996 facelift from somewhere outside this disc set.

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
