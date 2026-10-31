import { describe, expect, it } from 'bun:test';
import type { Label } from '../github/sync-labels.mjs';
import { planLabelChanges } from '../github/sync-labels.mjs';

const ready: Label = { name: 'status:ready', color: '0e8a16', description: 'Approved to start' };

describe('planLabelChanges', () => {
  it('creates a missing label', () => {
    expect(planLabelChanges([], [ready])).toEqual({ create: [ready], update: [] });
  });

  it('updates a label whose color or description differs', () => {
    const recolored = { ...ready, color: 'ffffff' };
    const reworded = { ...ready, description: 'old words' };
    expect(planLabelChanges([recolored], [ready])).toEqual({ create: [], update: [ready] });
    expect(planLabelChanges([reworded], [ready])).toEqual({ create: [], update: [ready] });
  });

  it('leaves an identical label alone, ignoring color case', () => {
    expect(planLabelChanges([{ ...ready, color: '0E8A16' }], [ready])).toEqual({
      create: [],
      update: [],
    });
  });

  it('never deletes labels it does not know', () => {
    const extra: Label = { name: 'bug', color: 'd73a4a', description: '' };
    expect(planLabelChanges([extra], [ready])).toEqual({ create: [ready], update: [] });
  });
});
