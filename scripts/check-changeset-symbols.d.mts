/**
 * Type surface for `check-changeset-symbols.mjs`, hand-written because the
 * implementation is plain ESM (matching every sibling `scripts/check-*.mjs`
 * gate) rather than TypeScript. Kept narrow: only what
 * `scripts/tests/check-changeset-symbols.test.ts` and any future consumer
 * actually need.
 */

export type Candidate = {
  raw: string;
  candidate: string;
  hasDot: boolean;
};

export type PublishTarget = {
  name: string;
  dir: string;
};

export declare const AMBIENT: Set<string>;

export declare function extractCandidates(text: string): Candidate[];

export declare function parseSymbolsOk(text: string): Set<string>;

export declare function parseExportedNames(distText: string): Set<string>;

export declare function parseMemberNames(text: string): Set<string>;

export declare function parseDeclaredNames(text: string): Set<string>;

export declare function resolveCandidate(
  candidate: string,
  hasDot: boolean,
  exportSet: Set<string>,
  memberSet: Set<string>,
): boolean;

export declare function findDistFile(pkgDir: string): string | null;

export declare function findUnbuiltPackages(targets: PublishTarget[]): PublishTarget[];

export declare function buildHeadSurface(targets: PublishTarget[]): {
  exportSet: Set<string>;
  memberSet: Set<string>;
};

export declare function resolveBaselineCommit(): string | null;

export declare function buildBaselineSurface(
  targets: PublishTarget[],
  baselineCommit: string | null,
): { exportSet: Set<string>; memberSet: Set<string> };

export declare function collectInputFiles(): string[];
