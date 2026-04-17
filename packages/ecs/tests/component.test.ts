import { beforeEach, describe, expect, it } from 'bun:test';
import { _resetComponentIds, defineComponent } from '../src/component.js';

beforeEach(() => {
  _resetComponentIds();
});

describe('defineComponent', () => {
  it('assigns sequential IDs', () => {
    const A = defineComponent('A');
    const B = defineComponent('B');
    expect(A.id).toBe(0);
    expect(B.id).toBe(1);
  });

  it('assigns correct bitmasks', () => {
    const A = defineComponent('A');
    const B = defineComponent('B');
    const C = defineComponent('C');
    expect(A.bit).toBe(1);
    expect(B.bit).toBe(2);
    expect(C.bit).toBe(4);
  });

  it('stores name', () => {
    const Pos = defineComponent('Position');
    expect(Pos.name).toBe('Position');
  });

  it('creates default values from factory', () => {
    const Pos = defineComponent('Position', () => ({ x: 0, y: 0 }));
    const data = Pos.create();
    expect(data).toEqual({ x: 0, y: 0 });
  });

  it('creates independent instances', () => {
    const Pos = defineComponent('Position', () => ({ x: 0, y: 0 }));
    const a = Pos.create();
    const b = Pos.create();
    a.x = 42;
    expect(b.x).toBe(0);
  });

  it('tag components (no defaults) create undefined', () => {
    const Tag = defineComponent('Tag');
    expect(Tag.create()).toBeUndefined();
  });
});
