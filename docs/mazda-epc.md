# The Mazda EPC discs

A second archive, from a different marque and a different vendor's software,
holding the same kind of thing the Nissan FAST discs do: one record per car
built. Source is the 2008 Mazda Electronic Parts Catalog — five ISO images,
2.7 GB.

**Nothing here is served by the site.** Output goes to `public/data/mazda/`
and nothing loads it. The site is a Nissan archive; whether it becomes
something wider is a decision about what the site IS, not about whether the
data parses.

## Why it was worth opening

The catalogue is VIN-indexed. Its own window title reads
`Pictorial index Image/Text VIN:LW3W-301101 - MPV / H15` — a chassis lookup,
exactly the thing that makes the Nissan discs worth having.

## Format

The discs are ISO 9660 and are read directly rather than mounted (`iso.js`):
the Primary Volume Descriptor sits at sector 16, its offset 156 holds the root
directory record, and that is enough to walk the tree and pull a file by its
extent. One trap — a zero length byte means "no more records in this sector",
not end of directory, so the walk must skip to the next sector. Stopping there
truncates every directory bigger than 2 KB, which is most of them.

Inside, everything is **Borland Paradox** tables (the `PDOXUSRS.LCK` beside
them is the giveaway). Each model directory carries a `BTCENVI.DB` — the
analogue of Nissan's `VINDAT`:

    2048-byte table header, then 4096-byte blocks. Each block opens with a
    6-byte header — next block, previous block, bytes-used — followed by
    40-byte records:

      [0..10]  chassis code, space padded   "   FD3S    "
      [11..16] serial                       "500013"
      [17..31] spec code                    "JPF141310NU FF1"
      [32..39] build date                   "19981216"

**The chassis field comes first.** Reading it last is tempting, because the
padding falls either side of the code and a dumped record reads naturally that
way — and it returns zero rows, not an error, because the date then lands on
the spec string. Blocks store `used` as (bytes used − recordSize), so the
record count is `used / 40 + 1`.

The build date is a full **YYYYMMDD**, finer than the YYMM Nissan FAST carries.

## What is on the discs

**661 chassis codes, 8,588,055 build records, 1983–2008.** Mostly Demio, MPV,
Familia, Capella, Bongo and Suzuki-derived kei. Extracted so far are the
fourteen rotary and roadster codes — **383,742 records**, no duplicates:

| chassis | car | records | built |
|---|---|---|---|
| `NA6CE` | Eunos Roadster 1.6 (MX-5 NA) | 87,650 | 1989-06-09 .. 1993-08-04 |
| `FC3S` | Savanna RX-7 (FC) | 80,514 | 1985-09-04 .. 1991-10-18 |
| `FD3S` | Efini RX-7 (FD) | 52,505 | 1991-10-19 .. 2002-08-26 |
| `SE3P` | RX-8 | 46,004 | 2003-02-14 .. 2008-09-02 |
| `NA8C` | Eunos Roadster 1.8 | 31,173 | 1993-07-30 .. 1997-10-28 |
| `BFMR` | Familia GT-X / GT-Ae turbo 4WD | 18,202 | 1985-09-27 .. 1989-01-19 |
| `NB8C` | Roadster 1.8 (NB) | 16,845 | 1997-12-10 .. 2005-04-11 |
| `NB6C` | Roadster 1.6 (NB) | 13,197 | 1997-12-10 .. 2005-04-28 |
| `NCEC` | Roadster (NC) | 12,606 | 2005-06-16 .. 2008-09-02 |
| `BG8Z` | Familia GT-R | 10,490 | 1989-07-11 .. 1994-03-31 |
| `JC3SE` | Eunos Cosmo 13B | 4,549 | 1990-02-24 .. 1994-01-26 |
| `JCESE` | Eunos Cosmo 20B triple-rotor | 3,576 | 1990-02-23 .. 1994-02-07 |
| `FC3C` | Savanna RX-7 Cabriolet | 3,411 | 1987-07-15 .. 1992-12-01 |
| `SA22C` | Savanna RX-7 (SA/FB) | 3,020 | 1983-08-30 .. 1985-07-31 |

The date ranges check out against known production independently of anything
in the files: FD3S runs 1991-10 to 2002-08, which is the FD's launch month to
the Spirit R run-out, and its 52,505 JDM cars sit correctly inside a ~68,600
worldwide total.

A chassis appears in several model directories and across two discs — FD3S is
spread over six `BTCENVI.DB` tables in RA1 and RB1 — and those ranges turn out
to be complementary rather than overlapping: **zero duplicates** on
chassis+serial+date across all 383,742.

## The spec code, decoded

The 15-character spec code splits into five fields:

| bytes | field | example | status |
|---|---|---|---|
| `[0..1]` | market | `JP` | one value on every JDM car |
| `[2..6]` | model / spec variant | `F1092` | positional reading, not decoded |
| `[7..8]` | equipment | `10`, `CW`, `CF` | positional reading, not decoded |
| `[9..11]` | **exterior paint** | `PZ`, `18G`, `25G` | **confirmed against BTCECLR** |
| `[12..14]` | **interior trim** | `FE2`, `FF1` | **confirmed against BTCECLR** |

So a car reads:

    FD3S-100028   1991-10-19   JP  F1092  10  paint NU   trim FE2
    FD3S-607313   2002-08-26   JP  F1763  CF  paint 25G  trim FF2

### How the colour fields were confirmed

`BTCECLR` is the colour-dependent parts table every model directory carries —
which part number applies for which paint. 55-byte records:

    [0..3] group   [6..10] part stem   [16..20] part   [21..23] variant
    [24..31] serial-from   [32..39] serial-to   [40..43] model
    [45..47] COLOUR CODE   [48..50] qualifier

Restricting it to the FD's own model code separates the two vocabularies
cleanly. Qualifier `298` yields `{18G, 20P, A3F, NU, PT}`, which is what cars
carry at `[9..11]`; qualifier `100` yields `{FF1}`, which is what they carry
at `[12..14]`.

Checked across all fourteen chassis, against every `BTCECLR` on all five
discs:

- **trim: 100% known** — every code on every chassis is one BTCECLR lists
- **paint: fully known on 11 of 14**, with four unlisted codes in total —
  `7V` on FC3S and FC3C (the same generation), `X2` and `X3` on FD3S. Those
  look like special-order colours.

Two sanity checks that do not depend on the files at all: `PZ` is the single
most common FD3S colour at 12,528 cars (23.9%), and Brilliant Black is
well-documented as the FD's most popular colour; `18G` and `25G` are real FD
colours (Montego Blue Mica, Competition Yellow).

### Padding is NUL, not space

A two-character paint code is stored `"NU\0"`. A plain `.trim()` leaves the
NUL attached and the code then matches nothing — which made 16 of the FD3S's
23 paint codes look absent from a table that lists them. The same padding is
used in the spec code itself, so the mistake lands on both sides of the
comparison at once and looks like real disagreement.

### No names

`BTCECLR` carries codes and no text, and none of the sibling tables is a
colour dictionary: `BTCESNM` holds part-group names in katakana
(`エンジン & ガスケット セット`), `BTCENTX` part text, `BTCEKAR` numeric codes,
and the shared root tables `BTCECHR`, `BTCEAI1` and `BTCEPPC` are part
cross-reference and pricing. A parts catalogue only needs the code to pick the
right painted panel, so the names may simply not be on these discs.

Codes are emitted as-is rather than guessed at, and the raw 15-character spec
is kept verbatim in `sc` alongside the split fields so nothing depends on this
reading being right forever.

## Still not decoded

`[2..6]` the model/spec variant and `[7..8]` the equipment code. The variant
is clearly meaningful — 43 distinct values on FD3S, each spanning only one to
three model years, so it encodes grade and era together — but nothing read so
far names them.
