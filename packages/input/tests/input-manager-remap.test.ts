import { describe, expect, spyOn, test } from 'bun:test';
import type { GamepadSnapshot } from '../src/gamepad.js';
import type { GamepadSource } from '../src/gamepad-source.js';
import { InputManager } from '../src/input-manager.js';
import { createIdentityRemap, type RemapTable } from '../src/remap.js';

type Button = GamepadSnapshot['buttons'][number];

function makeSnapshot(pressed: boolean[], axes: number[], timestamp = 0): GamepadSnapshot {
  return {
    id: 'pad',
    index: 0,
    timestamp,
    buttons: pressed.map((p) => ({ pressed: p, value: p ? 1 : 0 })),
    axes,
  };
}

/** A source whose `poll()` returns the queued frames in order, then repeats the last. */
function queueSource(frames: (GamepadSnapshot | null)[][]): GamepadSource {
  let i = 0;
  return {
    poll() {
      const frame = frames[Math.min(i, frames.length - 1)] ?? [];
      i++;
      return frame;
    },
  };
}

/** The manager-owned remapped snapshot for a pad; `undefined` when none is kept. */
function scratchOf(input: InputManager, index: number): GamepadSnapshot | undefined {
  const slots = (input as unknown as { _gamepadRemaps: Map<number, unknown> })._gamepadRemaps;
  const slot = slots.get(index) as { scratch?: GamepadSnapshot } | undefined;
  return slot?.scratch;
}

const swap: RemapTable = {
  buttons: [1, 0],
  axes: [{ index: 0, invert: true, scale: 1 }],
};

describe('InputManager gamepad remap', () => {
  test('consecutive polls reuse one remapped snapshot and keep values correct', () => {
    const input = new InputManager();
    input.setGamepadDeadZone(0);
    input.setGamepadRemap(0, swap);
    const source = queueSource([
      [makeSnapshot([true, false], [0.5], 1)],
      [makeSnapshot([false, true], [-0.25], 2)],
    ]);

    input.pollGamepads(source);
    const first = scratchOf(input, 0) as GamepadSnapshot;
    const firstButtons = first.buttons;
    const firstAxes = first.axes;
    const firstButton0 = first.buttons[0] as Button;
    expect(first.buttons).toEqual([
      { pressed: false, value: 0 },
      { pressed: true, value: 1 },
    ]);
    expect(first.axes).toEqual([-0.5]);
    expect(input.gamepad(0).buttons[0]?.pressed).toBe(false);
    expect(input.gamepad(0).buttons[1]?.pressed).toBe(true);
    expect(input.gamepad(0).axes[0]).toBe(-0.5);
    expect(input.gamepad(0).timestamp).toBe(1);

    input.update();
    input.pollGamepads(source);
    const second = scratchOf(input, 0) as GamepadSnapshot;
    expect(second).toBe(first);
    expect(second.buttons).toBe(firstButtons);
    expect(second.axes).toBe(firstAxes);
    expect(second.buttons[0]).toBe(firstButton0);
    expect(second.buttons).toEqual([
      { pressed: true, value: 1 },
      { pressed: false, value: 0 },
    ]);
    expect(second.axes).toEqual([0.25]);
    expect(input.gamepad(0).buttons[0]?.pressed).toBe(true);
    expect(input.gamepad(0).buttons[0]?.justPressed).toBe(true);
    expect(input.gamepad(0).buttons[1]?.pressed).toBe(false);
    expect(input.gamepad(0).buttons[1]?.justReleased).toBe(true);
    expect(input.gamepad(0).axes[0]).toBe(0.25);
    expect(input.gamepad(0).timestamp).toBe(2);
  });

  test('the source snapshot is not mutated and is not the remapped copy', () => {
    const input = new InputManager();
    input.setGamepadRemap(0, swap);
    const raw = makeSnapshot([true, false], [0.5], 1);
    const before = structuredClone(raw);
    input.pollGamepads(queueSource([[raw]]));
    expect(raw).toEqual(before);
    const scratch = scratchOf(input, 0) as GamepadSnapshot;
    expect(scratch).not.toBe(raw);
    expect(scratch.buttons).not.toBe(raw.buttons);
    expect(scratch.buttons[0]).not.toBe(raw.buttons[1] as Button);
  });

  test('setGamepadRemap with a larger table resizes the scratch', () => {
    const input = new InputManager();
    input.setGamepadDeadZone(0);
    input.setGamepadRemap(0, swap);
    const source = queueSource([[makeSnapshot([true, false, false, true], [0.5, -1], 1)]]);

    input.pollGamepads(source);
    expect(scratchOf(input, 0)?.buttons).toHaveLength(2);
    expect(scratchOf(input, 0)?.axes).toHaveLength(1);

    const wide: RemapTable = {
      buttons: [3, 2, 1, 0],
      axes: [
        { index: 1, invert: false, scale: 1 },
        { index: 0, invert: false, scale: 1 },
      ],
    };
    input.setGamepadRemap(0, wide);
    expect(scratchOf(input, 0)?.buttons).toHaveLength(4);
    expect(scratchOf(input, 0)?.axes).toHaveLength(2);

    input.update();
    input.pollGamepads(source);
    expect(scratchOf(input, 0)?.buttons).toEqual([
      { pressed: true, value: 1 },
      { pressed: false, value: 0 },
      { pressed: false, value: 0 },
      { pressed: true, value: 1 },
    ]);
    expect(scratchOf(input, 0)?.axes).toEqual([-1, 0.5]);
    expect(input.gamepad(0).buttons[0]?.pressed).toBe(true);
    expect(input.gamepad(0).buttons[3]?.pressed).toBe(true);
    expect(input.gamepad(0).axes[0]).toBe(-1);
    expect(input.gamepad(0).axes[1]).toBe(0.5);

    input.setGamepadRemap(0, swap);
    expect(scratchOf(input, 0)?.buttons).toHaveLength(2);
    expect(scratchOf(input, 0)?.axes).toHaveLength(1);
    input.update();
    input.pollGamepads(source);
    expect(scratchOf(input, 0)?.buttons).toEqual([
      { pressed: false, value: 0 },
      { pressed: true, value: 1 },
    ]);
    expect(scratchOf(input, 0)?.axes).toEqual([-0.5]);
  });

  test('a table grown in place after install still yields full-length arrays', () => {
    const input = new InputManager();
    input.setGamepadDeadZone(0);
    const table: RemapTable = { buttons: [1, 0], axes: [] };
    input.setGamepadRemap(0, table);
    const source = queueSource([[makeSnapshot([true, false, true], [0.5], 1)]]);
    input.pollGamepads(source);
    table.buttons.push(2);
    table.axes.push({ index: 0, invert: false, scale: 1 });
    input.pollGamepads(source);
    expect(scratchOf(input, 0)?.buttons).toEqual([
      { pressed: false, value: 0 },
      { pressed: true, value: 1 },
      { pressed: true, value: 1 },
    ]);
    expect(scratchOf(input, 0)?.axes).toEqual([0.5]);
    expect(input.gamepad(0).buttons[2]?.pressed).toBe(true);
  });

  test('each remapped pad has its own scratch', () => {
    const input = new InputManager();
    input.setGamepadRemap(0, swap);
    input.setGamepadRemap(1, createIdentityRemap(2, 1));
    input.pollGamepads(
      queueSource([[makeSnapshot([true, false], [0.5]), makeSnapshot([true, false], [0.5])]]),
    );
    const a = scratchOf(input, 0) as GamepadSnapshot;
    const b = scratchOf(input, 1) as GamepadSnapshot;
    expect(a).not.toBe(b);
    expect(a.buttons[0]?.pressed).toBe(false);
    expect(b.buttons[0]?.pressed).toBe(true);
    expect(input.gamepad(0).buttons[1]?.pressed).toBe(true);
    expect(input.gamepad(1).buttons[0]?.pressed).toBe(true);
  });

  test('clearing the remap drops the scratch and reads the pad unremapped', () => {
    const input = new InputManager();
    input.setGamepadRemap(0, swap);
    const source = queueSource([[makeSnapshot([true, false], [0.5])]]);
    input.pollGamepads(source);
    expect(input.gamepad(0).buttons[1]?.pressed).toBe(true);
    input.setGamepadRemap(0, null);
    expect(scratchOf(input, 0)).toBeUndefined();
    input.pollGamepads(source);
    expect(input.gamepad(0).buttons[0]?.pressed).toBe(true);
    expect(input.gamepad(0).buttons[1]?.pressed).toBe(false);
  });

  test('a disconnected remapped pad still reports the release edge', () => {
    const input = new InputManager();
    input.setGamepadRemap(0, swap);
    const source = queueSource([[makeSnapshot([true, false], [0.5])], [null]]);
    input.pollGamepads(source);
    input.update();
    input.pollGamepads(source);
    expect(input.gamepad(0).connected).toBe(false);
    expect(input.gamepad(0).buttons[1]?.justReleased).toBe(true);
  });

  test('pollGamepads does one Map lookup per pad', () => {
    const input = new InputManager();
    input.setGamepadRemap(0, swap);
    const source = queueSource([
      [makeSnapshot([true, false], [0.5]), makeSnapshot([true, false], [0.5])],
    ]);
    input.pollGamepads(source);

    const get = spyOn(Map.prototype, 'get');
    try {
      input.pollGamepads(source);
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      get.mockRestore();
    }
  });
});
