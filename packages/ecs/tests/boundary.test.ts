import { afterAll, describe, expect, it } from 'bun:test';
import { _resetComponentIds, defineComponent } from '../src/component.js';
import { World } from '../src/world.js';

// Boundary tests for the 32-component bitmask cap.
//
// Each test resets the module-global counter so it starts from 0 and can
// observe exact id and bit values. _resetComponentIds() is intentionally used
// here — these tests verify the boundary itself, and nothing else can pin an
// exact id. Every other ECS test file must NOT call it; see §11.3 NEW-5.
//
// The afterAll restores the counter to the value it held on ENTRY, not to 0.
// Resetting to 0 would be the dangerous state: any file loading later in this
// Bun worker that defines components at module scope would receive ids
// colliding with the built-ins (Position=0, Velocity=1, ...), which is exactly
// the mechanism-B collision this row exists to remove. Leaving it at 32 would
// be just as wrong — the next definition would throw.
//
// The entry value is captured by probing rather than by enumerating built-ins,
// so this file needs no import from a higher tier to know what to restore.
const _entryProbe = defineComponent('__boundary_entry_probe');
const ENTRY_COUNTER = _entryProbe.id;

afterAll(() => {
  _resetComponentIds();
  for (let i = 0; i < ENTRY_COUNTER; i++) {
    defineComponent(`__boundary_restore_${i}`);
  }
});

describe('32-component boundary', () => {
  it('32 defineComponent calls succeed with ids 0..31', () => {
    _resetComponentIds();
    const defs = Array.from({ length: 32 }, (_, i) => defineComponent(`Bnd${i}`));
    expect(defs[0]!.id).toBe(0);
    expect(defs[31]!.id).toBe(31);
    expect(defs).toHaveLength(32);
  });

  it('slot 31 bit is -2147483648 (1 << 31 in signed int32)', () => {
    _resetComponentIds();
    for (let i = 0; i < 31; i++) defineComponent(`Bnd31a${i}`);
    const comp31 = defineComponent('BndSlot31');
    expect(comp31.id).toBe(31);
    // 1 << 31 is a signed int32 operation in JS — the result is negative.
    // All bitwise ops (&, |, ~) are also int32, so query matching still works.
    expect(comp31.bit).toBe(-2147483648);
  });

  it('slot 31 round-trips through world.add / world.has / world.query / world.remove', () => {
    _resetComponentIds();
    for (let i = 0; i < 31; i++) defineComponent(`Bnd31b${i}`);
    const Comp31 = defineComponent('BndSlot31RT');
    expect(Comp31.id).toBe(31);
    expect(Comp31.bit).toBe(-2147483648);

    const world = new World();
    const e = world.spawn();

    world.add(e, Comp31);
    expect(world.has(e, Comp31)).toBe(true);

    const q = world.query(Comp31);
    expect(q.count).toBe(1);
    expect([...q]).toContain(e);

    world.remove(e, Comp31);
    expect(world.has(e, Comp31)).toBe(false);
    expect(q.count).toBe(0);
  });

  it('33rd defineComponent throws naming the component', () => {
    _resetComponentIds();
    for (let i = 0; i < 32; i++) defineComponent(`BndOvf${i}`);
    expect(() => defineComponent('Overflow')).toThrow(
      'Maximum 32 component types exceeded (defining "Overflow")',
    );
  });
});
