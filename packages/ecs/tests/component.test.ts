import { describe, expect, it } from 'bun:test';
import { defineComponent } from '../src/component.js';

// Components are defined once at module scope.  Tests compare relative IDs
// (B.id === A.id + 1) rather than absolute ones, so this file is safe to run
// in any position within a shared Bun process without needing _resetComponentIds.
const CompA = defineComponent('CompA');
const CompB = defineComponent('CompB');
const CompWithDefaults = defineComponent('CompWithDefaults', () => ({ x: 0, y: 0 }));
const TagComp = defineComponent('TagComp');

describe('defineComponent', () => {
  it('assigns sequential IDs', () => {
    expect(CompB.id).toBe(CompA.id + 1);
  });

  it('assigns correct bitmasks', () => {
    expect(CompA.bit).toBe(1 << CompA.id);
    expect(CompB.bit).toBe(1 << CompB.id);
  });

  it('stores name', () => {
    expect(CompA.name).toBe('CompA');
    expect(CompB.name).toBe('CompB');
  });

  it('creates default values from factory', () => {
    const data = CompWithDefaults.create();
    expect(data).toEqual({ x: 0, y: 0 });
  });

  it('creates independent instances', () => {
    const a = CompWithDefaults.create();
    const b = CompWithDefaults.create();
    a.x = 42;
    expect(b.x).toBe(0);
  });

  it('tag components (no defaults) create undefined', () => {
    expect(TagComp.create()).toBeUndefined();
  });
});
