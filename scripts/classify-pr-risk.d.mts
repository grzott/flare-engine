/**
 * Type surface for `classify-pr-risk.mjs`, hand-written because the
 * implementation is plain ESM like its sibling `scripts/*.mjs` gates.
 */

export type ChangedFile = {
  path: string;
  status: 'A' | 'M' | 'D' | 'R';
  added: string[];
  removed: string[];
};

/** `from: null` = dependency added; `to: null` = dependency removed. */
export type DepChange = { manifest: string; name: string; from: string | null; to: string | null };

export type ClassifyInput = {
  files: ChangedFile[];
  changesetLevels: Array<'patch' | 'minor' | 'major'>;
  depChanges: DepChange[];
  /** Manifests whose fields other than the four dependency maps changed. */
  manifestFieldChanges: string[];
  labels: string[];
  author: string;
};

export type RiskPolicy = {
  heldGlobs: string[];
  manifestGlobs: string[];
  dependencyBots: string[];
  exportScopeGlobs: string[];
};

export type RiskVerdict = { risk: 'auto' | 'held'; reasons: string[] };

export declare function classifyPrRisk(input: ClassifyInput, policy: RiskPolicy): RiskVerdict;

export declare function isMajorBump(from: string, to: string): boolean;

export declare function collectInput(
  base: string,
  head: string,
  labels: string[],
  author?: string,
): ClassifyInput;
