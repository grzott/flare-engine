import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { shatter } from '../../../src/core/presets';
import type { FxRuntime } from '../../../src/runtime/contracts';
import { installDom, type Rendered, render } from '../../support/dom';
import { installReanimatedMock } from '../../support/mock-reanimated';
import { installRnMock } from '../../support/mock-rn';
import { installSkiaMock } from '../../support/mock-skia';
import {
  ContextProbe,
  cancel,
  done,
  firstFrame,
  layerEffects,
  layers,
  settle,
  start,
} from './support';

installDom();
const rn = installRnMock();
installReanimatedMock();
installSkiaMock();

// Loaded after the mocks, so neither module reaches the real React Native or Skia.
const { acquireFastDisplayMode } = await import('../../../src/fx/native/display-mode');
const { NativeFxHost } = await import('../../../src/fx/native/host');

/** The calls the native module got, in order. */
let calls: string[] = [];

const installModule = (): void => {
  Reflect.set(globalThis, 'expo', {
    modules: {
      FlareUiFxDisplayMode: {
        setFastest: () => calls.push('set'),
        clear: () => calls.push('clear'),
      },
    },
  });
};

const rendered: Rendered[] = [];

beforeEach(() => {
  rn.reset();
  calls = [];
  installModule();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
  layers.length = 0;
  Reflect.deleteProperty(globalThis, 'expo');
});

function mount(): FxRuntime {
  let fx: FxRuntime | null = null;
  rendered.push(
    render(
      <NativeFxHost effects={layerEffects()}>
        <ContextProbe
          onContext={(ctx) => {
            fx = ctx.fx;
          }}
        />
      </NativeFxHost>,
    ),
  );
  if (fx === null) throw new Error('the host provided no runtime');
  return fx;
}

describe('acquireFastDisplayMode', () => {
  test('the first acquire sets the mode and the last release clears it', () => {
    const first = acquireFastDisplayMode();
    expect(calls).toEqual(['set']);
    const second = acquireFastDisplayMode();
    expect(calls).toEqual(['set']);

    first();
    expect(calls).toEqual(['set']);
    second();
    expect(calls).toEqual(['set', 'clear']);
  });

  test('releasing twice counts once', () => {
    const first = acquireFastDisplayMode();
    const second = acquireFastDisplayMode();
    first();
    first();
    expect(calls).toEqual(['set']);
    second();
    expect(calls).toEqual(['set', 'clear']);
  });

  test('sets the mode again after it was cleared', () => {
    acquireFastDisplayMode()();
    acquireFastDisplayMode()();
    expect(calls).toEqual(['set', 'clear', 'set', 'clear']);
  });

  test('a module call that throws or rejects is swallowed', async () => {
    Reflect.set(globalThis, 'expo', {
      modules: {
        FlareUiFxDisplayMode: {
          setFastest: () => Promise.reject(new Error('no activity')),
          clear: () => {
            throw new Error('no activity');
          },
        },
      },
    });

    expect(() => acquireFastDisplayMode()()).not.toThrow();
    // An unhandled rejection would fail the test here.
    await Promise.resolve();
  });

  test.each(['ios', 'web'])('is a no-op on %s', (os) => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      rn.platform.OS = os;
      Reflect.deleteProperty(globalThis, 'expo');
      acquireFastDisplayMode()();
      installModule();
      acquireFastDisplayMode()();

      expect(calls).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test('a missing module neither throws nor warns more than once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      Reflect.deleteProperty(globalThis, 'expo');
      acquireFastDisplayMode()();
      Reflect.set(globalThis, 'expo', { modules: {} });
      const release = acquireFastDisplayMode();
      acquireFastDisplayMode()();
      release();

      expect(calls).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('30–60 Hz');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('the host', () => {
  test('two overlapping runs set the mode once, and clear it once after both end', async () => {
    const fx = mount();
    start(fx, shatter());
    start(fx, shatter());
    await settle();
    const [a, b] = [layers[0]!, layers[1]!];
    // Nothing is asked for while the captures are in flight or the layers are mounting.
    expect(calls).toEqual([]);

    firstFrame(a);
    expect(calls).toEqual(['set']);
    firstFrame(b);
    expect(calls).toEqual(['set']);

    done(a, true);
    expect(calls).toEqual(['set']);
    done(b, true);
    expect(calls).toEqual(['set', 'clear']);
  });

  test('a run cancelled before handoff never asks for the mode', async () => {
    const fx = mount();
    const { run } = start(fx, shatter());
    await settle();
    cancel(run);
    await settle();

    expect(calls).toEqual([]);
  });

  test('the host unmounting clears the mode a playing run holds', async () => {
    const fx = mount();
    start(fx, shatter());
    await settle();
    firstFrame(layers[0]!);
    expect(calls).toEqual(['set']);

    for (const r of rendered.splice(0)) r.unmount();
    expect(calls).toEqual(['set', 'clear']);
  });
});
