import type { Params } from './types.js';

/**
 * Parse a `scheme://host/path?query` or `/path?query` URL into its path
 * segments and query params. Returns `null` if the input is malformed.
 *
 * This is intentionally minimal: it does not validate scheme, does not decode
 * fragments, and ignores username/password.
 */
export interface ParsedUrl {
  scheme: string | null;
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
  if (schemeIdx !== -1) {
    scheme = rest.slice(0, schemeIdx);
    rest = rest.slice(schemeIdx + 3);
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      host = rest;
      rest = '/';
    } else {
      host = rest.slice(0, slashIdx);
      rest = rest.slice(slashIdx);
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
