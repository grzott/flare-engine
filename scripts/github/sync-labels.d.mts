/**
 * Type surface for `sync-labels.mjs`, hand-written because the implementation
 * is plain ESM like its sibling scripts.
 */

export type Label = { name: string; color: string; description: string };

export declare function planLabelChanges(
  existing: Label[],
  desired: Label[],
): { create: Label[]; update: Label[] };
