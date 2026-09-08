import { describe, expect, test } from 'bun:test';
import { createWebGamepadSource } from '../src/gamepad-source.js';

describe('createWebGamepadSource', () => {
  test('returns empty array when navigator has no getGamepads', () => {
    const src = createWebGamepadSource({});
    expect(src.poll()).toEqual([]);
  });

  test('maps connected pads to snapshots and leaves gaps null', () => {
    const src = createWebGamepadSource({
      getGamepads: () => [
        {
          id: 'pad-1',
          index: 0,
          connected: true,
          timestamp: 123,
          buttons: [
            { pressed: true, value: 1 },
            { pressed: false, value: 0 },
          ],
          axes: [0.1, -0.2],
        },
        null,
        {
          id: 'pad-3',
          index: 2,
          connected: false,
          timestamp: 0,
          buttons: [],
          axes: [],
        },
      ],
    });
    const pads = src.poll();
    expect(pads.length).toBe(3);
    expect(pads[0]?.id).toBe('pad-1');
    expect(pads[0]?.buttons[0]).toEqual({ pressed: true, value: 1 });
    expect(pads[0]?.axes).toEqual([0.1, -0.2]);
    expect(pads[1]).toBe(null);
    // Disconnected pads normalize to null.
    expect(pads[2]).toBe(null);
  });

  test('poll() returns fresh objects on every call, never a reused snapshot', () => {
    // Same underlying pad array returned by reference on every call, so any
    // identity collision below can only come from poll() itself reusing output.
    const pads = [
      {
        id: 'pad-1',
        index: 0,
        connected: true,
        timestamp: 1,
        buttons: [{ pressed: true, value: 1 }],
        axes: [0.5],
      },
    ];
    const src = createWebGamepadSource({ getGamepads: () => pads });
    const first = src.poll();
    const second = src.poll();
    expect(first[0]).not.toBe(second[0]);
    expect(first[0]?.buttons).not.toBe(second[0]?.buttons);
    expect(first[0]?.axes).not.toBe(second[0]?.axes);
  });
});
