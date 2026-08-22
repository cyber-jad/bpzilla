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

// rows/cols of the page that are mostly ink = ruling lines
function findLines(rows, width, axis, minFrac) {
  const n = axis === 'h' ? rows.length : width;
  const m = axis === 'h' ? width : rows.length;
  const hits = [];
  for (let i = 0; i < n; i++) {
    let dark = 0;
    for (let j = 0; j < m; j++) {
      const v = axis === 'h' ? rows[i][j] : rows[j][i];
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
  const colLines = findLines(rows, width, 'v', opt.minColFrac || 0.30);
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
  const rowLines = findLines(rows, width, 'h', opt.minRowFrac || 0.45);
  const colLines = findLines(rows, width, 'v', opt.minColFrac || 0.30);
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
  const inks = [];
  for (const row of marks) for (const c of row) if (c.mark === 'ring') inks.push(c.ink);
  inks.sort((a, b) => a - b);
  const median = inks.length ? inks[Math.floor(inks.length / 2)] : 0;
  const heavy = median * 1.35;
  for (const row of marks) for (const c of row) {
    if (c.mark === 'ring') c.mark = (median && c.ink >= heavy) ? 'standard' : 'option';
  }
  return { rows, marks, rowLines, colLines, medianInk: median };
}

module.exports = { readMatrix, readMarks, describe, findLines, classify };
