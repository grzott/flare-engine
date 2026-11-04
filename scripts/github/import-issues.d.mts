/**
 * Type surface for `import-issues.mjs`, hand-written because the implementation
 * is plain ESM like its sibling scripts.
 */

export type BacklogMilestone = { title: string; description: string; due_on: string | null };

export type BacklogIssue = {
  id: string;
  title: string;
  body: string;
  labels: string[];
  milestone: string | null;
};

export type BacklogManifest = { milestones: BacklogMilestone[]; issues: BacklogIssue[] };

export type ExistingIssue = { number: number; body: string | null };

export declare function backlogMarker(id: string): string;

export declare function validateManifest(
  m: BacklogManifest,
  knownLabels: readonly string[],
  pathExists: (p: string) => boolean,
): string[];

export declare function planIssueImport(
  m: BacklogManifest,
  existingIssues: readonly ExistingIssue[],
  existingMilestones: readonly string[],
): { createMilestones: BacklogMilestone[]; createIssues: BacklogIssue[]; skipped: string[] };
