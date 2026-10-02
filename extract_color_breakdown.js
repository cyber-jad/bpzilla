/**
 * BPZILLA — per-model color/variant breakdown generator
 *
 * Writes public/data/colorBreakdown.json: for every browsable model, its real
 * factory paint-code breakdown and grade/variant breakdown, straight from
 * database.js's own getModelStats() — the exact same numbers the client-side
 * color chart on each model page already shows. Nothing here is invented or
 * re-derived by a second implementation; it is the one real computation,
 * captured once so the edge worker can quote it in a page's indexed
 * description without parsing 28 MB of records on every request (the same
 * reason models.json exists — see extract_models.js).
 *
 * Only the top colors/grades are kept (cap below): a 47-row color table for
 * S13 would bloat the description past anything a search snippet shows, and
 * the full table is still one tap away on the page itself for a visitor.
 *
 * Run: node extract_color_breakdown.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = __dirname;
const DATA = path.join(REPO, 'public', 'data');
const OUT = path.join(DATA, 'colorBreakdown.json');
const TOP_N = 5;

function loadDatabase() {
  const src = fs.readFileSync(path.join(REPO, 'public', 'js', 'database.js'), 'utf8');
  const fetchStub = async (url) => {
    const file = path.join(DATA, String(url).replace(/^\/?data\//, ''));
    if (!fs.existsSync(file)) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => fs.readFileSync(file, 'utf8') };
  };
  const sandbox = {
    window: {}, document: {}, console,
    fetch: fetchStub,
    location: { protocol: 'https:', hostname: 'gtr-registry.org' },
    performance: { now: () => 0 },
    setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__DB = JDM_DATABASE;', sandbox, { timeout: 20000 });
  return sandbox.__DB || sandbox.window.JDM_DATABASE;
}

async function main() {
  const DB = loadDatabase();
  await DB.loadFastData();

  const out = { generated: new Date().toISOString().slice(0, 10), models: {} };
  let modelsWithColors = 0;

  for (const key of Object.keys(DB.models)) {
    const stats = DB.getModelStats(key);
    if (!stats || !stats.totalCount) continue;

    // colorBreakdown's code comes straight from the record with no
    // remainder-labelling (unlike gradeBreakdown below) -- a record with no
    // color on file carries code: '', filtered out here rather than shown as
    // a blank row.
    //
    // getModelStats()'s own name lookup does not apply the R35-specific
    // paint-name table (_r35PaintNames, see database.js) -- that table was
    // added after getModelStats, and nothing in the live client-side chart
    // calls it either, so R35 colors come back from the archive as bare
    // codes (QAB, KAD, ...) same as here. Re-resolved just for this
    // generated file with the exact lookup the rest of the codebase already
    // uses (app.js's own color-name resolution), rather than leaving our
    // flagship model's breakdown less readable than every other chassis.
    const colors = (stats.colorBreakdown || [])
      .filter((c) => c.code)
      .slice(0, TOP_N)
      .map((c) => {
        const r35Name = DB._isR35Model(key) ? DB._r35PaintNames[c.code] : null;
        return { code: c.code, name: r35Name || c.name, count: c.count, percent: c.percent };
      });

    const grades = (stats.gradeBreakdown || [])
      .filter((g) => g.grade && g.grade !== DB.UNDECODED_LABEL)
      .slice(0, TOP_N)
      .map((g) => ({ grade: g.grade, count: g.count, percent: g.percent }));

    if (!colors.length && !grades.length) continue;
    out.models[key] = { totalCount: stats.totalCount, colors, grades };
    modelsWithColors++;
  }

  if (!modelsWithColors) {
    console.error('Refusing to write: no model produced a color or grade breakdown. ' +
      'Check the fetch stub against the path database.js uses.');
    process.exit(1);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  const bytes = fs.statSync(OUT).size;
  console.log(`Wrote breakdowns for ${modelsWithColors} models to ${path.relative(REPO, OUT)} (${(bytes / 1024).toFixed(1)} KB).`);
}

main();
