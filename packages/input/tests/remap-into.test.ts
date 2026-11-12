import { describe, expect, test } from 'bun:test';
import type { GamepadSnapshot } from '../src/gamepad.js';
import { applyRemap, applyRemapInto, createIdentityRemap, type RemapTable } from '../src/remap.js';

function emptySnapshot(): GamepadSnapshot {
  return { id: '', index: 0, timestamp: 0, buttons: [], axes: [] };
}

const snap: GamepadSnapshot = {
  id: 'pad-x',
  index: 2,
  timestamp: 1234,
  buttons: [
    { pressed: true, value: 1 },
    { pressed: false, value: 0 },
    { pressed: true, value: 0.5 },
    { pressed: false, value: 0.25 },
  ],
  axes: [0.5, -0.25, 1],
};

const identity = createIdentityRemap(4, 3);
const swapped: RemapTable = {
  buttons: [1, 0, 3, 2],
  axes: [
    { index: 1, invert: false, scale: 1 },
    { index: 0, invert: false, scale: 1 },
  ],
};
const invertedScaled: RemapTable = {
  buttons: [2],
  axes: [
    { index: 0, invert: true, scale: 0.5 },
    { index: 2, invert: false, scale: 2 },
  ],
};
const unmapped: RemapTable = {
  buttons: [9, 0, 17],
  axes: [
    { index: 7, invert: true, scale: 1 },
    { index: 1, invert: false, scale: 1 },
  ],
};
const wide = createIdentityRemap(17, 4);
const empty: RemapTable = { buttons: [], axes: [] };

const tables: [string, RemapTable][] = [
  ['identity', identity],
  ['swapped buttons and axes', swapped],
  ['inverted and scaled axes', invertedScaled],
  ['unmapped physical buttons and axes', unmapped],
  ['wider than the snapshot', wide],
  ['empty', empty],
];

describe('applyRemapInto', () => {
  for (const [name, table] of tables) {
    test(`matches applyRemap: ${name}`, () => {
      const out = emptySnapshot();
      const result = applyRemapInto(snap, table, out);
      expect(result).toBe(out);
      expect(result).toEqual(applyRemap(snap, table));
    });
  }

  test('unmapped buttons read released and unmapped axes read 0', () => {
    const out = applyRemapInto(snap, unmapped, emptySnapshot());
    expect(out.buttons).toEqual([
      { pressed: false, value: 0 },
      { pressed: true, value: 1 },
      { pressed: false, value: 0 },
    ]);
    expect(out.axes[0]).toBeCloseTo(0);
    expect(out.axes[1]).toBe(-0.25);
    expect(out.id).toBe('pad-x');
    expect(out.index).toBe(2);
    expect(out.timestamp).toBe(1234);
  });

  test('reuses the scratch arrays and button objects across calls', () => {
    const out = emptySnapshot();
    applyRemapInto(snap, swapped, out);
    const buttons = out.buttons;
    const axes = out.axes;
    const first = out.buttons[0];

    const next: GamepadSnapshot = {
      id: 'pad-y',
      index: 1,
      timestamp: 99,
      buttons: [
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: true, value: 0.75 },
      ],
      axes: [-1, 1, 0],
    };
    applyRemapInto(next, swapped, out);
    expect(out.buttons).toBe(buttons);
    expect(out.axes).toBe(axes);
    expect(out.buttons[0]).toBe(first as GamepadSnapshot['buttons'][number]);
    expect(out).toEqual(applyRemap(next, swapped));
  });

  test('a scratch grows for a larger table and shrinks for a smaller one', () => {
    const out = emptySnapshot();
    applyRemapInto(snap, identity, out);
    applyRemapInto(snap, wide, out);
    expect(out.buttons).toHaveLength(17);
    expect(out.axes).toHaveLength(4);
    expect(out).toEqual(applyRemap(snap, wide));

    applyRemapInto(snap, invertedScaled, out);
    expect(out.buttons).toHaveLength(1);
    expect(out.axes).toHaveLength(2);
    expect(out).toEqual(applyRemap(snap, invertedScaled));
  });

  test('does not mutate the source snapshot', () => {
    const copy = structuredClone(snap);
    applyRemapInto(snap, swapped, emptySnapshot());
    expect(snap).toEqual(copy);
  });

  test('applyRemap still returns a fresh snapshot each call', () => {
    const a = applyRemap(snap, identity);
    const b = applyRemap(snap, identity);
    expect(a).not.toBe(b);
    expect(a.buttons).not.toBe(b.buttons);
    expect(a.buttons[0]).not.toBe(b.buttons[0] as GamepadSnapshot['buttons'][number]);
    expect(a.axes).not.toBe(b.axes);
    expect(a.buttons[0]).not.toBe(snap.buttons[0] as GamepadSnapshot['buttons'][number]);
  });
});
