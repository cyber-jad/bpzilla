// version_assets.js - stamp /css and /js references with a content hash.
//
// WHY THIS EXISTS
//
// index.html is revalidated on every visit; /css/* and /js/* are cached for a
// minute and then served stale for up to a week while they refresh in the
// background (see public/_headers). Those two rules disagree by design, so the
// first load after any deploy pairs NEW markup with the OLD script. That is not
// hypothetical - it shipped a chassis lookup whose box rendered and whose
// button did nothing, and again when the M35 removal went live and the archive
// kept reporting its old record count until the second page load.
//
// stale-while-revalidate shrank that window from an hour to one visit but
// cannot close it. Hashing the URL does: fresh markup asks for
// /js/app.js?v=1f4c2a9b, a URL no cache has ever seen, so the pair can never
// disagree. Nothing about the caching policy has to be weakened - the files
// stay cacheable and the page still paints from cache without a round trip.
//
// The hash is per file, so editing one script busts one URL and the rest stay
// cached.
//
// USAGE
//   node version_assets.js          rewrite the HTML in place
//   node version_assets.js --check  exit 1 if any stamp is stale, change nothing
//
// Run it after changing anything under public/css or public/js and before
// committing. --check is the same test without the write, for a hook or CI.
// Forgetting to run it is not a regression: the URLs simply keep their previous
// stamps and behave exactly as they did before this script existed.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, 'public');
const PAGES = ['index.html', '404.html'];

// Matches href="/css/x.css" and src="/js/x.js", with or without an existing
// ?v= stamp. Only root-relative local paths - a CDN URL has a scheme and is
// left alone, which is what we want since we cannot hash what we do not serve.
const REF = /(href|src)="(\/(?:css|js)\/[^"?]+)(\?v=[^"]*)?"/g;

function hashOf(urlPath) {
  const file = path.join(ROOT, urlPath.replace(/^\//, ''));
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex')
    .slice(0, 8);
}

const check = process.argv.includes('--check');
let changed = 0, missing = [], scanned = 0;

for (const page of PAGES) {
  const full = path.join(ROOT, page);
  if (!fs.existsSync(full)) continue;
  const before = fs.readFileSync(full, 'utf8');

  const after = before.replace(REF, (whole, attr, urlPath, oldStamp) => {
    scanned++;
    const h = hashOf(urlPath);
    // An asset the HTML references but public/ does not hold is a broken link,
    // not something to stamp. Report it rather than writing a URL that 404s.
    if (!h) { missing.push(page + ' -> ' + urlPath); return whole; }
    const want = `${attr}="${urlPath}?v=${h}"`;
    if (want !== whole) changed++;
    return want;
  });

  if (after !== before && !check) fs.writeFileSync(full, after);
}

if (missing.length) {
  console.error('referenced but not present in public/:');
  for (const m of missing) console.error('  ' + m);
}

console.log(`${scanned} asset reference${scanned === 1 ? '' : 's'} across ${PAGES.length} pages`);

if (check) {
  if (changed) {
    console.error(`${changed} stamp${changed === 1 ? ' is' : 's are'} stale - run: node version_assets.js`);
    process.exit(1);
  }
  console.log('all stamps current');
} else {
  console.log(changed ? `${changed} stamp${changed === 1 ? '' : 's'} updated` : 'already current, nothing written');
}

if (missing.length) process.exit(1);
