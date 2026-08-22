/**
 * BPZILLA — model index generator
 *
 * Writes public/data/models.json: one entry per browsable model, with the
 * name, chassis code, years, engine and exact record count.
 *
 * The edge worker needs this to give each /model/<KEY> and /chassis/<NUMBER>
 * URL a real <title> and description instead of the homepage's. It can't work
 * the counts out for itself — that would mean parsing 28 MB of records on
 * every request — and hand-copying the table into the worker would drift from
 * database.js the first time a model was added.
 *
 * So the numbers come from database.js itself, running its real loader against
 * the real files with fetch stubbed to read from disk. Grade-split models
 * (ER34_GT vs ER34_GTT, PS13 vs KPS13) are counted by the same gradeFilter
 * logic the site uses, rather than a second implementation that could disagree.
 *
 * Run: node extract_models.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = __dirname;
const DATA = path.join(REPO, 'public', 'data');
const OUT = path.join(DATA, 'models.json');

function loadDatabase() {
  const src = fs.readFileSync(path.join(REPO, 'public', 'js', 'database.js'), 'utf8');

  // The loader calls fetch('/data/<file>') — serve those off the disk so the
  // real load path runs unchanged.
  //
  // Accepts the path with or without a leading slash. It used to strip only
  // "data/", and when the loader moved to the absolute "/data/..." every file
  // resolved to the wrong place and 404'd. The generator still exited 0 with an
  // empty index, so nothing failed loudly — models.json simply stopped being
  // regenerated, and went stale enough to keep serving /model/ pages for a
  // chassis that had been removed from the site.
  const fetchStub = async (url) => {
    const file = path.join(DATA, String(url).replace(/^\/?data\//, ''));
    if (!fs.existsSync(file)) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => fs.readFileSync(file, 'utf8') };
  };

  const sandbox = {
    window: {}, document: {}, console,
    fetch: fetchStub,
    // database.js checks location.protocol when a load fails, to tell a real
    // error from someone opening index.html off the filesystem. Anything
    // non-"file:" keeps that check on the ordinary path.
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

  // Refuse to write an index built from nothing.
  //
  // This script used to fail silently: when the loader's data path changed,
  // every file 404'd, it wrote an index of zero-count models and exited 0.
  // Nothing downstream noticed, so the LAST GOOD models.json stayed deployed
  // and the worker kept serving /model/ pages from it — including pages for a
  // chassis that had since been removed from the site. A generator that can
  // quietly produce a wrong-but-valid file is worse than one that crashes.
  const loaded = Object.keys(DB.models).reduce((sum, key) => {
    const s = DB.getModelStats(key);
    return sum + (s ? s.totalCount : 0);
  }, 0);
  if (!loaded) {
    console.error('Refusing to write: loaded 0 records. The data files did not ' +
                  'load — check the fetch stub against the path database.js uses.');
    process.exit(1);
  }

  const out = { generated: new Date().toISOString().slice(0, 10), total: 0, models: {} };

  for (const key of Object.keys(DB.models)) {
    const m = DB.models[key];
    const stats = DB.getModelStats(key);
    const count = stats ? stats.totalCount : 0;
    out.total += count;
    out.models[key] = {
      name: m.name,
      short: m.shortName,
      code: m.chassisCode || '',
      years: m.years || '',
      engine: m.engine || '',
      body: m.bodyStyle || '',
      // The prefix a chassis number actually carries, which is what a
      // /chassis/<NUMBER> URL has to be matched against.
      stamp: m.chassisStamp || m.chassisPrefix || key,
      legend: !!DB.isLegend(key),
      count
    };
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');

  const n = Object.keys(out.models).length;
  const bytes = fs.statSync(OUT).size;
  console.log(`Wrote ${n} models to ${path.relative(REPO, OUT)} (${(bytes / 1024).toFixed(1)} KB).`);
  console.log(`Total records: ${out.total.toLocaleString()}`);

  const missing = Object.entries(out.models).filter(([, v]) => !v.count);
  if (missing.length) console.log('WARNING — models with no records:', missing.map(x => x[0]).join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
