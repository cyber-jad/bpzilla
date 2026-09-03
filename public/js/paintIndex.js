/**
 * BPZILLA - NISSAN SKYLINE OEM PAINT CODE ENCYCLOPEDIA
 * Authentic paint formulas, color swatches, production volume, and model applications for all Skyline generations.
 */

// This is a hand-curated list of hero colors, not derived from the FAST
// records the way JDM_DATABASE's colorBreakdown is. totalProduced and
// rarityScore here come from outside sourcing and will not necessarily match
// the archive-wide paint table rendered alongside it (app.js's
// renderAllColorsTable) — the two are deliberately kept separate rather than
// reconciled, since this list also covers pre-FAST cars the archive has no
// records for at all (see the Hakosuka/Kenmeri entries below).
const PAINT_INDEX = [
  {
    code: 'TV2',
    name: 'Bayside Blue Metallic (Wangan Blue)',
    hex: '#114B8C',
    finish: 'Metallic Pearl (2-Stage)',
    models: ['Skyline GT-R (BNR34)', 'Skyline GT-T (ER34)'],
    years: '1998 - 2002',
    totalProduced: 7552,
    rarityScore: 'Signature Hero Hue',
    notes: 'The iconic hero color of the R34 generation. Developed specifically to capture high-speed light reflections along Tokyo\'s Shuto Expressway (Wangan-sen).'
  },
  {
    code: 'LV4',
    name: 'Midnight Purple II Pearl (ChromaFlair)',
    hex: '#2A1838',
    finish: 'Special Optical Pearl (Shifts Violet → Bronze → Deep Blue)',
    models: ['Skyline GT-R (BNR34 - 1999 Only)'],
    years: '1999',
    totalProduced: 282,
    rarityScore: '2.44% of R34 GT-R Production (Ultra Rare)',
    notes: 'Single-year limited production color using high-grade ChromaFlair interference pigments. Highly prized by global collectors.'
  },
  {
    code: 'LX0',
    name: 'Midnight Purple III Pearl',
    hex: '#220D32',
    finish: 'ChromaFlair Pearl (Shifts Purple → Gold → Magenta)',
    models: ['Skyline GT-R (BNR34 - 2000 Only)'],
    years: '2000',
    totalProduced: 132,
    rarityScore: '1.14% of R34 GT-R Production (Grail)',
    notes: 'Introduced for the launch of Series 2 R34. Even rarer than Midnight Purple II with dramatic gold and magenta color shifts under direct sun.'
  },
  {
    code: 'JW0',
    name: 'Millennium Jade Metallic',
    hex: '#7D8577',
    finish: 'Fine-grain Champagne-Olive Metallic',
    models: ['Skyline GT-R R34 V-Spec II Nür / M-Spec Nür', 'GT-R R35 T-Spec'],
    years: '2002, 2021-2024',
    totalProduced: 676,
    rarityScore: 'Nür Exclusive (Top Tier Grail)',
    notes: 'Created exclusively for the final 1,000 Nür specification R34 GT-Rs in 2002 (156 units) and revived for the R35 T-Spec.'
  },
  {
    code: 'EY0',
    name: 'Silica Breath Metallic',
    hex: '#C2B89D',
    finish: 'Warm Titanium-Gold Pearl Metallic',
    models: ['Skyline GT-R R34 M-Spec & M-Spec Nür'],
    years: '2001 - 2002',
    totalProduced: 141,
    rarityScore: '1.22% of R34 GT-R Production',
    notes: 'Exclusive hero color for the luxury leather M-Spec (Mizuno Spec) Skyline GT-R.'
  },
  {
    code: 'EV1',
    name: 'Lightning Yellow',
    hex: '#E8C01D',
    finish: 'Vibrant Solid Yellow',
    models: ['Skyline GT-T Coupe (ER34 GT-T)'],
    years: '1998 - 2002',
    totalProduced: 1120,
    rarityScore: '4.17% of ER34 Production (Rare)',
    notes: 'The rarest factory production sport color on the Nissan Skyline ER34 GT-T 2-door coupe.'
  },
  {
    code: 'LP2',
    name: 'Midnight Purple Pearl (Original)',
    hex: '#261330',
    finish: 'Deep Solid Pearl',
    models: ['Skyline GT-R (BCNR33)', 'Skyline GTS25-t (ECR33)'],
    years: '1993 - 1998',
    totalProduced: 11413,
    rarityScore: 'Signature R33 Hero Color',
    notes: 'The original Midnight Purple that established the legendary Nissan halo hue across all R33 GT-R and GTS-t models.'
  },
  {
    code: 'BT2',
    name: 'Champion Blue',
    hex: '#1A5DAA',
    finish: 'Solid Gloss Sport Blue',
    models: ['Skyline GT-R R33 LM Limited Only'],
    years: '1996',
    totalProduced: 188,
    rarityScore: '1.13% of R33 GT-R (Only 188 Built)',
    notes: 'Created exclusively for the 188 LM Limited R33 GT-Rs built to celebrate Nissan\'s GT-R LM participation in the 24 Hours of Le Mans.'
  },
  {
    code: 'KH2',
    name: 'Gun Grey Metallic',
    hex: '#4E5357',
    finish: 'Classic Gunmetal Metallic',
    models: ['Skyline GT-R (BNR32)', 'Skyline GTS-t (HCR32)'],
    years: '1989 - 1994',
    totalProduced: 58090,
    rarityScore: 'Definitive Godzilla R32 Color',
    notes: 'The definitive color of Godzilla. 100% of the 560 factory Group A NISMO homologation cars were painted in KH2 Gun Grey.'
  },
  // Hakosuka/Kenmeri codes below use synthetic ids (WHITE_703, not a
  // real 3-character FAST code) because these cars predate the loaded FAST
  // archive entirely — there is no chassis record to cross-reference them
  // against, unlike every other entry in this file.
  {
    code: 'WHITE_703',
    name: 'Grand Prix White (Code 703)',
    hex: '#F4F5F0',
    finish: 'Solid Classic White',
    models: ['Skyline 2000GT-R Kenmeri (KPGC110)'],
    years: '1973',
    totalProduced: 170,
    rarityScore: 'Kenmeri GT-R Main Color (170 of 197 Built)',
    notes: 'The principal factory color for 170 of the 197 legendary Kenmeri GT-Rs manufactured in early 1973.'
  },
  {
    code: 'SILVER_701',
    name: 'Silver Metallic (Code 701)',
    hex: '#B8BDC4',
    finish: 'Classic Metallic Silver',
    models: ['Skyline 2000GT-R Kenmeri (KPGC110)'],
    years: '1973',
    totalProduced: 20,
    rarityScore: 'Kenmeri Unicorn (Only 20 Built)',
    notes: 'Only 20 Kenmeri GT-Rs were built in Silver Metallic. One of the highest-valued collector cars in Japan.'
  },
  {
    code: 'RED_702',
    name: 'Red (Code 702)',
    hex: '#B31B1B',
    finish: 'Solid Classic Racing Red',
    models: ['Skyline 2000GT-R Kenmeri (KPGC110)'],
    years: '1973',
    totalProduced: 7,
    rarityScore: 'Kenmeri Crown Jewel (Only 7 Built)',
    notes: 'Only 7 factory Red Kenmeri GT-Rs were ever produced in total history.'
  },
  {
    code: 'HAKO_SILVER',
    name: 'Grand Prix Silver Metallic',
    hex: '#B5BAC0',
    finish: 'Single-Stage Fine Metallic',
    models: ['Skyline 2000GT-R Hakosuka (KPGC10 / PGC10)'],
    years: '1969 - 1972',
    totalProduced: 1320,
    rarityScore: 'Hakosuka Signature Hero Color',
    notes: 'The signature metallic silver paired with bolt-on black rear overfenders and Japanese Works racing liveries.'
  }
];

if (typeof window !== 'undefined') {
  window.PAINT_INDEX = PAINT_INDEX;
}
