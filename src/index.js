/**
 * BPZILLA — edge request handling
 *
 * Everything on this site is a static asset except for one decision: whether a
 * request for /data/ is a browser loading the archive, or something helping
 * itself to the archive.
 *
 * The problem this solves
 * ----------------------
 * The record files are the site. `curl https://bpzilla.com/data/fast_hcr32.json`
 * returned 144,097 records in 0.41s with no browser, no referer and no session —
 * forty of those and someone has the whole 1.28M-record archive in a few
 * seconds. robots.txt says not to, but robots.txt is a request, not a control,
 * and the crawlers worth worrying about are exactly the ones that ignore it.
 *
 * What this can and can't do
 * --------------------------
 * It cannot make the data uncopyable. The archive is queried in the visitor's
 * browser, so the browser must receive all of it, and anything a browser can
 * receive a headless browser can receive too. What it does is remove the free
 * option: copying the archive stops being one shell command and starts needing
 * a real browser driven page by page, which is slower, noisier, and rate-limitable
 * at the edge. That is a genuine difference in practice even though it isn't
 * prevention. The only true fix is not shipping the corpus at all — see the
 * "Data Model" section of docs/architecture.html for why it is shipped.
 *
 * How a legitimate request is recognised
 * -------------------------------------
 * A fetch() issued by our own page carries at least one of three same-origin
 * signals. Any one of them is accepted, because no single one is universal:
 * Sec-Fetch-Site is absent on Safari before 16.4, and Referer can be stripped
 * by a privacy extension or a stricter referrer policy. A direct hit with none
 * of them — which is what every scraper, curl and wget sends — is refused.
 */

const DATA_PREFIX = '/data/';

/**
 * Is this request the site's own page asking for its data?
 * Returns the signal that vouched for it, or null if nothing did.
 */
function sameOriginSignal(request, origin) {
  // Set by the browser itself and not settable from script, so it's the
  // strongest of the three where it exists.
  if (request.headers.get('Sec-Fetch-Site') === 'same-origin') return 'sec-fetch-site';

  // Sent on a same-origin fetch under the default referrer policy.
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      if (new URL(referer).origin === origin) return 'referer';
    } catch { /* malformed Referer — treat as absent */ }
  }

  // Present on CORS-mode fetches.
  if (request.headers.get('Origin') === origin) return 'origin';

  return null;
}

function refused() {
  const body =
    'The BPZILLA factory records are served to the archive itself, not as a ' +
    'bulk download.\n\n' +
    'If you are looking at this because something you wrote stopped working: ' +
    'requests for /data/ now have to come from a page on bpzilla.com. If you ' +
    'want this data for a project, ask — contact@bpzilla.com — rather than ' +
    'scraping it. It took a long time to decode and it is given freely to ' +
    'anyone who asks.\n';

  return new Response(body, {
    status: 403,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Never let a refusal be cached and then handed to a real visitor, or
      // the reverse. This decision is per-request, not per-URL.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex'
    }
  });
}

function tooMany() {
  return new Response(
    'Too many requests for the factory records from this address.\n\n' +
    'The archive is 40 files fetched once per page load; this limit sits well ' +
    'above that. If you need the data in bulk, ask — contact@bpzilla.com.\n',
    {
      status: 429,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '60',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex'
      }
    }
  );
}

/**
 * Per-IP limit on /data/, which is the half of this that a spoofed header
 * can't get around. Deliberately fails open: if the binding is missing or
 * throws, the request is allowed. A rate limiter having a bad day must never
 * be the reason the archive stops loading.
 */
async function withinRateLimit(request, env) {
  const limiter = env.DATA_RATE_LIMIT;
  if (!limiter || typeof limiter.limit !== 'function') return true;
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    return true;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(DATA_PREFIX)) {
      // Nothing here is writable, so anything that isn't a read is already wrong.
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }
        });
      }
      // Origin check first: it's local and free, so a request that was never
      // going to be served doesn't spend a rate-limit call on the way out.
      if (!sameOriginSignal(request, url.origin)) return refused();
      if (!(await withinRateLimit(request, env))) return tooMany();
    }

    return env.ASSETS.fetch(request);
  }
};
