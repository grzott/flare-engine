import { parseUrl } from './parse.js';
import type { DeepLinkMatch, Params } from './types.js';

/**
 * Route pattern like `/bench/:id` or `/shop/:category/:item`. Segments
 * starting with `:` are captured; literal segments must match exactly.
 * The `*` segment matches the remainder of the path into a `rest` param.
 */
export interface RouteDefinition {
  pattern: string;
  scene: string;
}

interface CompiledRoute {
  scene: string;
  segments: Array<{ literal?: string; param?: string; wildcard?: boolean }>;
}

export class DeepLinkRouter {
  private routes: CompiledRoute[] = [];

  register(pattern: string, scene: string): this {
    this.routes.push({ scene, segments: compile(pattern) });
    return this;
  }

  registerAll(defs: readonly RouteDefinition[]): this {
    for (const def of defs) this.register(def.pattern, def.scene);
    return this;
  }

  match(url: string): DeepLinkMatch | null {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    for (const route of this.routes) {
      const params = tryMatch(route, parsed.segments);
      if (!params) continue;
      const combined: Params = { ...parsed.query, ...params };
      return { scene: route.scene, params: combined, url };
    }
    return null;
  }
}

function compile(pattern: string): CompiledRoute['segments'] {
  return pattern
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => {
      if (s === '*') return { wildcard: true };
      if (s.startsWith(':')) return { param: s.slice(1) };
      return { literal: s };
    });
}

function tryMatch(route: CompiledRoute, segs: readonly string[]): Params | null {
  const out: Params = {};
  const segCount = route.segments.length;
  for (let i = 0; i < segCount; i++) {
    const def = route.segments[i];
    if (!def) return null;
    if (def.wildcard) {
      out.rest = segs.slice(i).join('/');
      return out;
    }
    const actual = segs[i];
    if (actual === undefined) return null;
    if (def.literal !== undefined) {
      if (def.literal !== actual) return null;
    } else if (def.param !== undefined) {
      out[def.param] = actual;
    }
  }
  if (segs.length !== segCount) return null;
  return out;
}
