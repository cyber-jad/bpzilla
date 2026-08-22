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

| chassis | volume | front-matter pages | records | option decode |
|---|---|---|---|---|
| R30 (DR30)   | 077 | 16 | 44,439  | none yet |
| R31 (HR31)   | 078 | 36 | 182,351 | none yet |
| R32          | 079 | 27 | 295,861 | done, from this legend |
| R33          | 080 |  2 | 180,398 | done, from FASTOP |
| R34          | 081 | 11 |  67,040 | done, FASTOP + this legend's second window |
| RS13         | 084 | 17 |  26,740 | none yet |
| S13          | 087 | 18 | 165,864 | none yet — see note |
| PS13 / KS13  | 087 | —  | 136,777 | none yet — see note |
| S14          | 088 | 15 |  84,826 | partial, from FASTOP |
| WC34 (Stagea)| 110 | 3  | 133,408 | done, from FASTOP |
| Z32          | 132 | 12 | 162,666 | none yet |
| M35          | 153 | 22 |  30,487 | none yet |
| AM35 (Autech)| 163 |  — |       — | Autech variant of M35 |

Note on S13: the S13, PS13, KS13 and RS13 files in `public/data` share one model
code vocabulary — their `mc` dictionaries begin with the same entries (`13JFTW`,
`13HFW`, `13JAT`) — so volumes 087 and 084 together should cover all 329,381
records across the four files rather than one file each.

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
