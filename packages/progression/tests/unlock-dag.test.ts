import { describe, expect, it } from 'bun:test';
import { createUnlockDag } from '../src/index.js';

describe('createUnlockDag — isUnlocked', () => {
  const dag = createUnlockDag([
    { id: 'a', requires: [] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['a', 'b'] },
  ]);

  it('node with no requirements is always unlocked', () => {
    expect(dag.isUnlocked(new Set(), 'a')).toBe(true);
  });

  it('returns false for unknown id', () => {
    expect(dag.isUnlocked(new Set(['a']), 'z')).toBe(false);
  });

  it('requires unsatisfied', () => {
    expect(dag.isUnlocked(new Set(), 'b')).toBe(false);
  });

  it('requires satisfied', () => {
    expect(dag.isUnlocked(new Set(['a']), 'b')).toBe(true);
  });

  it('all requires must be satisfied', () => {
    expect(dag.isUnlocked(new Set(['a']), 'c')).toBe(false);
    expect(dag.isUnlocked(new Set(['a', 'b']), 'c')).toBe(true);
  });
});

describe('createUnlockDag — frontier', () => {
  const dag = createUnlockDag([
    { id: 'a', requires: [] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['a'] },
    { id: 'd', requires: ['b', 'c'] },
  ]);

  it('empty cleared: frontier = root nodes', () => {
    expect(dag.frontier(new Set())).toEqual(['a']);
  });

  it('after clearing a: frontier includes b and c', () => {
    const f = dag.frontier(new Set(['a']));
    expect(f).toContain('b');
    expect(f).toContain('c');
    expect(f).not.toContain('a');
    expect(f).not.toContain('d');
  });

  it('after clearing a,b: frontier includes c only (d not yet)', () => {
    const f = dag.frontier(new Set(['a', 'b']));
    expect(f).toContain('c');
    expect(f).not.toContain('d');
  });

  it('after clearing a,b,c: frontier is d', () => {
    expect(dag.frontier(new Set(['a', 'b', 'c']))).toEqual(['d']);
  });

  it('all cleared: frontier is empty', () => {
    expect(dag.frontier(new Set(['a', 'b', 'c', 'd']))).toEqual([]);
  });
});

describe('createUnlockDag — allUnlocked', () => {
  const dag = createUnlockDag([
    { id: 'a', requires: [] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['b'] },
  ]);

  it('empty cleared: only root nodes', () => {
    expect(dag.allUnlocked(new Set())).toEqual(['a']);
  });

  it('cleared a: a and b (b requirement met)', () => {
    expect(dag.allUnlocked(new Set(['a']))).toContain('b');
  });

  it('cleared a,b: all three', () => {
    const all = dag.allUnlocked(new Set(['a', 'b']));
    expect(all).toContain('a');
    expect(all).toContain('b');
    expect(all).toContain('c');
  });
});

describe('createUnlockDag — duplicate id throws', () => {
  it('throws on duplicate', () => {
    expect(() =>
      createUnlockDag([
        { id: 'a', requires: [] },
        { id: 'a', requires: [] },
      ]),
    ).toThrow();
  });
});

describe('createUnlockDag — unknown requires tolerated', () => {
  it('node with missing require is locked when require not in cleared', () => {
    const dag = createUnlockDag([{ id: 'a', requires: ['ghost'] }]);
    expect(dag.isUnlocked(new Set(), 'a')).toBe(false);
  });

  it('node with require in cleared is unlocked (cleared is the authority, not graph membership)', () => {
    const dag = createUnlockDag([{ id: 'a', requires: ['ghost'] }]);
    expect(dag.isUnlocked(new Set(['ghost']), 'a')).toBe(true);
  });
});
