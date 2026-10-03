// build_r35_options.js - turn the transcribed R35 option legend (docs/wip/r35-options.json,
// read from volume 215's オプション記号 pages) into the compact table the site loads.
//
//   node build_r35_options.js
//
// Output public/data/r35Options.json: date windows, each mapping a plate position (14-18) and an option
// letter to the equipment codes it means, plus one English line per equipment code. Read-only on the source.
'use strict';
const fs = require('fs'), path = require('path');
const src = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs', 'wip', 'r35-options.json'), 'utf8'));

const specs = {};
for (const [code, v] of Object.entries(src.specs)) specs[code] = v.en;

const windows = src.windows.map(w => {
  const positions = {};
  for (const [pos, letters] of Object.entries(w.positions || {})) {
    positions[pos] = {};
    for (const [ch, codes] of Object.entries(letters)) if (ch !== '-' && codes.length) positions[pos][ch] = codes;
  }
  return { from: w.from, to: w.to, positions, note: w._note || undefined };
});

// Every code a window uses must have a line of text, or a car would show a bare code.
const missing = new Set();
for (const w of windows) for (const p of Object.values(w.positions)) for (const c of Object.values(p)) for (const code of c) if (!specs[code]) missing.add(code);
if (missing.size) { console.error('codes with no text:', [...missing].join(', ')); process.exit(1); }

fs.writeFileSync(path.join(__dirname, 'public', 'data', 'r35Options.json'), JSON.stringify({
  _source: 'volume 215 option pages JD01-JD10, transcribed 2026-09-04; see docs/fast-volumes.md',
  _rule: 'A window starts on its from month (the boundary month belongs to the newer window). A letter the owning window does not define is looked up in the nearest other window and marked reported, not confirmed.',
  windows, specs
}));
console.log('windows', windows.length, 'specs', Object.keys(specs).length);
