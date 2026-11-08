/**
 * Type surface for `check-exported-types.mjs`, hand-written because the
 * implementation is plain ESM like every sibling `scripts/**\/*.mjs` gate.
 */

export interface AllowlistEntry {
  pkg: string;
  name: string;
  reason: string;
}

export interface Hole {
  name: string;
  /** Public names that reach it; a reach through hidden types reads `f via Outer > Inner`. */
  reachedFrom: string[];
}

export interface PackageReport {
  holes: Hole[];
  allowlisted: string[];
  stale: string[];
}

export interface AnalyzeInput {
  name: string;
  entryPaths: readonly string[];
  read: (path: string) => string | undefined;
  allowlist?: readonly AllowlistEntry[];
}

export declare const ALLOWLIST: readonly AllowlistEntry[];

export declare function typesEntriesOf(manifest: { exports?: unknown; types?: unknown }): string[];

export declare function analyzePackage(input: AnalyzeInput): PackageReport;
