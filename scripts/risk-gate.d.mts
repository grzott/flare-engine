/**
 * Type surface for `risk-gate.mjs`, hand-written because the implementation
 * is plain ESM like its sibling `scripts/*.mjs` gates.
 */
import type { RiskVerdict } from './classify-pr-risk.mjs';

export type Review = {
  user: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  commitId: string;
};

export type ReviewVerdict = 'pass' | 'changes' | 'held';

export type GateInput = {
  verdict: RiskVerdict;
  author: string;
  botLogin: string;
  ownerLogin: string;
  headSha: string;
  reviews: Review[];
  reviewVerdict: ReviewVerdict | null;
  labels: string[];
  requestedReviewers: string[];
};

export type GateDecision = {
  risk: 'auto' | 'held';
  reasons: string[];
  pass: boolean;
  summary: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
  requestOwnerReview: boolean;
};

export declare function decideGate(input: GateInput): GateDecision;

export declare function parseReviewVerdict(
  comments: Array<{ user: string; body: string }>,
  headSha: string,
): ReviewVerdict | null;
