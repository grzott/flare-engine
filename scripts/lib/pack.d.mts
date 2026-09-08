/**
 * Type surface for `pack.mjs`, hand-written because the implementation is
 * plain ESM (matching every sibling `scripts/**\/*.mjs` gate) rather than
 * TypeScript. Kept narrow: only what `scripts/tests/pack-registry.test.ts`
 * and any future consumer actually need.
 */

export declare const NPMJS_REGISTRY: string;

export type RegistryCheck = { ok: true } | { ok: false; message: string };

export declare function checkRegistry(value: string): RegistryCheck;
