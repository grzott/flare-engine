/**
 * Type surface for `scan-history.mjs`, hand-written because the implementation
 * is plain ESM like every sibling `scripts/**\/*.mjs` gate.
 */

export interface LineClassification {
  secrets: { category: string; value: string }[];
  exposure: string[];
}

export declare function redact(value: string): string;

export declare function classifyLine(line: string): LineClassification;

export declare function isSensitivePath(path: string): boolean;

export declare function isDetectorSource(path: string): boolean;
