import type { Params } from './types.js';

/**
 * Parse a URL into its path segments and query params.
 *
 * Host extraction (tri-state `host` field):
 *   - `http`/`https`: authority (everything before the first `/?#`) → `host`.
 *   - Any other scheme (`myapp://`, etc.): `host = ''`; the entire post-`://`
 *     remainder is treated as the path.
 *   - Relative (schemeless) URL: `host = null`.
 *
 * The http authority substring retains userinfo/port as-is
 * (`https://user:pass@h:8080/p` → `host = 'user:pass@h:8080'`); routing
 * only uses `segments` + `query`, so `host` is informational only.
 *
 * Non-goals: opaque `scheme:` forms without `//` are treated as a relative
 * path; backslash paths are not normalised (RN Linking semantics, not WHATWG).
 */
export interface ParsedUrl {
  scheme: string | null;
  /**
   * Tri-state:
   *   - `string` (non-empty): http/https authority (e.g. `'example.com'`).
   *   - `''` (empty string): custom scheme, authority-less (e.g. `myapp://`).
   *   - `null`: relative URL with no scheme.
   */
  host: string | null;
  segments: string[];
  query: Params;
}

export function parseUrl(url: string): ParsedUrl | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  let rest = url;
  let scheme: string | null = null;
  let host: string | null = null;

  const schemeIdx = rest.indexOf('://');
  if (schemeIdx !== -1 && /^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(rest.slice(0, schemeIdx))) {
    scheme = rest.slice(0, schemeIdx);
    rest = rest.slice(schemeIdx + 3);
    const lower = scheme.toLowerCase();
    if (lower === 'http' || lower === 'https') {
      // Universal link: the authority precedes the first /?# delimiter.
      const delimIdx = rest.search(/[/?#]/);
      if (delimIdx === -1) {
        host = rest;
        rest = '/';
      } else {
        host = rest.slice(0, delimIdx);
        rest = rest.slice(delimIdx);
      }
    } else {
      // Custom (RN Linking) scheme: no authority — everything after :// is the path.
      host = '';
      if (rest.length === 0 || rest[0] !== '/') rest = `/${rest}`;
    }
  }

  // Strip fragment.
  const hashIdx = rest.indexOf('#');
  if (hashIdx !== -1) rest = rest.slice(0, hashIdx);

  let path = rest;
  let queryStr = '';
  const qIdx = rest.indexOf('?');
  if (qIdx !== -1) {
    path = rest.slice(0, qIdx);
    queryStr = rest.slice(qIdx + 1);
  }

  const segments = path
    .split('/')
    .filter((s) => s.length > 0)
    .map(safeDecode);
  const query: Params = {};
  if (queryStr.length > 0) {
    for (const pair of queryStr.split('&')) {
      if (pair.length === 0) continue;
      const eq = pair.indexOf('=');
      const rawKey = eq === -1 ? pair : pair.slice(0, eq);
      const rawVal = eq === -1 ? '' : pair.slice(eq + 1);
      const key = safeDecode(rawKey);
      if (key.length === 0) continue;
      query[key] = safeDecode(rawVal);
    }
  }

  return { scheme, host, segments, query };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, '%20'));
  } catch {
    return s;
  }
}
