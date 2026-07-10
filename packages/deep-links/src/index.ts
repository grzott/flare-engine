export {
  DeepLinkManager,
  type DeepLinkManagerOptions,
  type DeepLinkSource,
} from './manager.js';
export { type ParsedUrl, parseUrl } from './parse.js';
export { DeepLinkRouter, type RouteDefinition } from './router.js';
export {
  createMemorySource,
  createNativeSource,
  createWebSource,
  type LinkingLike,
} from './sources.js';
export type { DeepLinkMatch, Params, ParamValue } from './types.js';
