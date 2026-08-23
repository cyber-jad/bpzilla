// fast_matrix.js - read the option-code matrices off a FAST legend page.
//
// The legend pages are feature-by-code tables with a circle in a cell when that
// code includes that feature. Transcribing them by eye is the weak link: the
// pages render around 1280px wide, a circle is ~12px across, and a table can be
// 13 features by 24 codes. Misreading one cell ships a wrong fact.
//
// So: read the ROW LABELS and COLUMN HEADERS by eye - they are large text and
// unambiguous - and let this find the circles. It returns which (row, column)
// cells are marked, which is the part a person is bad at and a computer is good
// at.
//
// Method, deliberately simple so it fails loudly rather than quietly:
//   1. Find the table's ruling lines by looking for rows and columns of the
//      bitmap that are mostly black. Those give the cell grid.
//   2. For each cell, count dark pixels in its interior.
//   3. A cell holding a circle has a dark-pixel count in a distinct band well
//      above an empty cell. Report the counts so the caller can see the
//      separation rather than trust a hardcoded threshold.
//
// It does NOT try to read the text. That is the point.

'use strict';
const { decodeG4 } = require('./fast_image.js');

// rows/cols of the page that are mostly ink = ruling lines.
//
// `span` limits the search to a band, and matters more than it looks. A column
// rule is only as tall as its table, so measuring its darkness against the whole
// page height punishes short tables: page 5 of the Z32 volume is a seven-row
// table on a full page, its rules cover well under a third of the height, and
// the column search returned nothing at all. Measuring within the table's own
// vertical extent instead makes the threshold mean what it should.
function findLines(rows, width, axis, minFrac, span) {
  const n = axis === 'h' ? rows.length : width;
  const lo = span ? Math.max(0, span[0]) : 0;
  const hi = span ? Math.min(axis === 'h' ? width : rows.length, span[1])
                  : (axis === 'h' ? width : rows.length);
  const m = hi - lo;
  if (m <= 0) return [];
  const hits = [];
  for (let i = 0; i < n; i++) {
    let dark = 0;
    for (let j = lo; j < hi; j++) {
      const v = axis === 'h' ? rows[i][j] : (rows[j] ? rows[j][i] : 255);
      if (v < 128) dark++;
    }
    if (dark / m >= minFrac) hits.push(i);
  }
  // collapse runs of adjacent lines to their midpoint
  const out = [];
  let start = null, prev = null;
  for (const i of hits) {
    if (start === null) { start = prev = i; continue; }
    if (i - prev <= 2) { prev = i; continue; }
    out.push(Math.round((start + prev) / 2)); start = prev = i;
  }
  if (start !== null) out.push(Math.round((start + prev) / 2));
  return out;
}

function darkCount(rows, x0, y0, x1, y1, inset) {
  let d = 0;
  for (let y = y0 + inset; y < y1 - inset; y++) {
    const r = rows[y]; if (!r) continue;
    for (let x = x0 + inset; x < x1 - inset; x++) if (r[x] < 128) d++;
  }
  return d;
}

/**
 * @param {Buffer} stream  raw G4 stream for the page
 * @param {object} opt     { width, minRowFrac, minColFrac, inset }
 * @returns {{ grid, cells, rowLines, colLines }}
 *   cells[r][c] = dark pixel count for that cell interior
 */
function readMatrix(stream, opt = {}) {
  const width = opt.width || 1280;
  const { rows } = decodeG4(stream, width, opt.maxRows || 5000);
  const rowLines = findLines(rows, width, 'h', opt.minRowFrac || 0.45);
  const band = rowLines.length >= 2 ? [rowLines[0], rowLines[rowLines.length - 1]] : null;
  const colLines = findLines(rows, width, 'v', opt.minColFrac || 0.60, band);
  const cells = [];
  for (let r = 0; r + 1 < rowLines.length; r++) {
    const line = [];
    for (let c = 0; c + 1 < colLines.length; c++) {
      line.push(darkCount(rows, colLines[c], rowLines[r], colLines[c + 1], rowLines[r + 1], opt.inset || 2));
    }
    cells.push(line);
  }
  return { rows, cells, rowLines, colLines };
}

// Render a cell-count grid as a picture, so the separation between "circle" and
// "empty" can be eyeballed before any threshold is chosen.
function describe(cells, threshold) {
  const flat = cells.flat().filter(v => v > 0).sort((a, b) => a - b);
  const out = [];
  out.push('cells ' + cells.length + ' x ' + (cells[0] || []).length);
  if (flat.length) {
    const q = p => flat[Math.min(flat.length - 1, Math.floor(p * flat.length))];
    out.push('nonzero counts: min ' + flat[0] + '  p25 ' + q(.25) + '  median ' + q(.5) +
             '  p75 ' + q(.75) + '  max ' + flat[flat.length - 1]);
  }
  if (threshold != null) {
    out.push('with threshold ' + threshold + ':');
    for (const row of cells) out.push('  ' + row.map(v => v >= threshold ? 'O' : '.').join(''));
  }
  return out.join('\n');
}

// Some tables use three symbols rather than one, and the difference is not
// decorative. The Z32 pages key them explicitly:
//   ◎ 標準       standard equipment
//   ○ オプション   available option
//   △ レスオプション  delete-option (fitted as standard, deletable to order)
//
// Ink alone cannot separate ○ from △ — a triangle's outline is about as long as
// a circle's, and both land near 30 pixels where ◎ lands near 48. Treating a
// delete-option as an option would invert its meaning, so shape has to be read.
//
// The discriminator is simple and robust: a triangle is narrow at the top and
// wide at the bottom, a circle is widest in the middle and symmetric. Measure
// the dark run in the top third against the bottom third of the symbol's own
// bounding box and compare.
function classify(rows, x0, y0, x1, y1, inset) {
  const pts = [];
  for (let y = y0 + inset; y < y1 - inset; y++) {
    const r = rows[y]; if (!r) continue;
    for (let x = x0 + inset; x < x1 - inset; x++) if (r[x] < 128) pts.push([x, y]);
  }
  if (pts.length < 8) return { mark: null, ink: pts.length };
  const ink = pts.length;
  const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const h = ymax - ymin + 1, w = xmax - xmin + 1;
  if (h < 4 || w < 4) return { mark: null, ink };
  const bandWidth = (a, b) => {
    const sel = pts.filter(p => p[1] >= a && p[1] <= b).map(p => p[0]);
    return sel.length ? Math.max(...sel) - Math.min(...sel) + 1 : 0;
  };
  const top = bandWidth(ymin, ymin + Math.max(1, Math.round(h * 0.25)) - 1);
  const bot = bandWidth(ymax - Math.max(1, Math.round(h * 0.25)) + 1, ymax);
  // A triangle's top band is a fraction of its base; a circle's are comparable.
  // Triangular is decided here; ◎ against ○ needs the whole page (see below),
  // so this reports the geometry and lets readMarks finish the job.
  const triangular = top > 0 && bot > 0 && (top / bot) < 0.55;
  return { mark: triangular ? 'delete' : 'ring', ink, w, h };
}

// Same grid as readMatrix, but each cell is classified rather than counted.
function readMarks(stream, opt = {}) {
  const width = opt.width || 1280;
  const { rows } = decodeG4(stream, width, opt.maxRows || 5000);
  let rowLines = findLines(rows, width, 'h', opt.minRowFrac || 0.45);
  // `rowBand` limits the walk to one table on a page that stacks several.
  //
  // Volume 089 page 5 carries the 16-digit and 17-digit option tables one above
  // the other, and they do not share a column count - 12 codes against 8. Read
  // as one grid they come out as neither, so the caller says which vertical
  // slice it means and gets that table on its own.
  if (opt.rowBand) {
    const [y0, y1] = opt.rowBand;
    rowLines = rowLines.filter(y => y >= y0 && y <= y1);
  }
  const band = rowLines.length >= 2 ? [rowLines[0], rowLines[rowLines.length - 1]] : null;
  const colLines = findLines(rows, width, 'v', opt.minColFrac || 0.60, band);
  const marks = [];
  for (let r = 0; r + 1 < rowLines.length; r++) {
    const line = [];
    for (let c = 0; c + 1 < colLines.length; c++) {
      line.push(classify(rows, colLines[c], rowLines[r], colLines[c + 1], rowLines[r + 1], opt.inset || 2));
    }
    marks.push(line);
  }

  // ◎ against ○, decided per page rather than by a fixed number.
  //
  // The double ring is drawn slightly larger than the single one, so density and
  // centre-ink both fail to separate them — but raw ink does, and cleanly: on
  // the Z32 pages the single rings sit at 30-34 and the double rings at 45-51,
  // a gap with nothing in it. An absolute threshold would not survive a page
  // drawn at a different size, so take the median ring as the baseline and call
  // anything a third heavier a double ring. That reads the gap wherever it is.
  // Take the baseline from the DATA rows only. Where a table has a multi-level
  // header — the Z32 pages stack 車型タイプ over トランスミッション over パック記号 —
  // those rows are full of text, every cell reads as a fat "ring", and they drag
  // the median up until real ◎ marks fall under the threshold and read as plain
  // options. On Z32 page 5 that put the median at 73 against a true symbol ink
  // of about 32. The caller knows where its header ends; let it say so.
  const from = opt.dataFrom == null ? 0 : opt.dataFrom;
  // Skip the label column too: it holds the feature names, whose ink dwarfs any
  // symbol and stretches the spread until no gap looks significant.
  const colFrom = opt.dataCol == null ? 1 : opt.dataCol;
  const inks = [];
  for (let r = from; r < marks.length; r++)
    for (let c = colFrom; c < marks[r].length; c++)
      if (marks[r][c].mark === 'ring') inks.push(marks[r][c].ink);
  // Split on the biggest gap in the sorted inks, not on a multiple of the
  // median. Taking the median as the single-ring baseline assumes single rings
  // are the majority, and on Z32 page 6 they are not — ◎ dominates, the median
  // lands at 86 which IS the double ring, and a 1.35x threshold then finds no
  // standard marks at all. The two populations are well separated wherever they
  // both occur (30-34 against 45-51 on one page, 51 against 86 on another), so
  // find the widest gap and cut there. If there is no real gap the marks are all
  // one kind, and everything stays a plain option.
  inks.sort((a, b) => a - b);
  let cut = Infinity;
  if (inks.length > 3) {
    const lo = inks[0], hi = inks[inks.length - 1];
    let best = 0, at = -1;
    for (let k = 1; k < inks.length; k++) {
      const gap = inks[k] - inks[k - 1];
      if (gap > best) { best = gap; at = k; }
    }
    // A real gap is a decent fraction of the whole spread, not sampling noise.
    if (at > 0 && hi > lo && best >= Math.max(4, (hi - lo) * 0.35)) cut = inks[at];
  }
  for (const row of marks) for (const c of row) {
    if (c.mark === 'ring') c.mark = (c.ink >= cut) ? 'standard' : 'option';
  }
  return { rows, marks, rowLines, colLines, inkCut: cut === Infinity ? null : cut };
}

module.exports = { readMatrix, readMarks, describe, findLines, classify };
