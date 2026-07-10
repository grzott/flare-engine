import type { GamepadSnapshot } from './gamepad.js';

/**
 * Platform abstraction for sampling connected gamepads.
 *
 * `poll()` returns one snapshot per slot (typically up to 4). Unconnected
 * slots return `null`. Implementations:
 *
 * - `createWebGamepadSource()` wraps the W3C `navigator.getGamepads` API.
 * - Native implementations (e.g., `react-native-gamepad`) inject their own
 *   via the `GamepadSource` interface — the package itself ships no native deps.
 */
export interface GamepadSource {
  poll(): (GamepadSnapshot | null)[];
}

interface NavigatorLike {
  getGamepads?: () => (WebGamepad | null)[];
}

interface WebGamepad {
  id: string;
  index: number;
  connected: boolean;
  timestamp: number;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}

/**
 * Wrap `navigator.getGamepads()` (W3C Gamepad API). If `nav` is not supplied,
 * uses `globalThis.navigator`. Returns an empty array when the API is absent.
 */
export function createWebGamepadSource(nav?: NavigatorLike): GamepadSource {
  const source: NavigatorLike | undefined =
    nav ??
    (typeof globalThis === 'undefined'
      ? undefined
      : (globalThis as { navigator?: NavigatorLike }).navigator);

  return {
    poll(): (GamepadSnapshot | null)[] {
      if (!source?.getGamepads) return [];
      const pads = source.getGamepads();
      const out: (GamepadSnapshot | null)[] = new Array(pads.length);
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        if (!p?.connected) {
          out[i] = null;
          continue;
        }
        out[i] = webGamepadToSnapshot(p);
      }
      return out;
    },
  };
}

function webGamepadToSnapshot(p: WebGamepad): GamepadSnapshot {
  const buttons = new Array<{ pressed: boolean; value: number }>(p.buttons.length);
  for (let i = 0; i < p.buttons.length; i++) {
    const b = p.buttons[i];
    buttons[i] = { pressed: b?.pressed ?? false, value: b?.value ?? 0 };
  }
  const axes = new Array<number>(p.axes.length);
  for (let i = 0; i < p.axes.length; i++) axes[i] = p.axes[i] ?? 0;
  return { id: p.id, index: p.index, timestamp: p.timestamp, buttons, axes };
}
