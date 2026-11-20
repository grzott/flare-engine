import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { disintegrate, dust, fade, press, shatter } from '../../src/core/presets';
import { createPresetRegistry } from '../../src/core/registry';
import { delay, sequence } from '../../src/core/timeline';
import {
  type ElementPlatform,
  type FlareElementHandle,
  type FlareElementOptions,
  useFlareElement,
} from '../../src/runtime/element';
import { FlarePresence } from '../../src/runtime/presence';
import { FlareContext, type FlareContextValue } from '../../src/runtime/provider-context';
import { installDom, type Rendered, render } from '../support/dom';
import {
  createFakeDriver,
  createFakeFxRuntime,
  createFakeTarget,
  type FakeDriver,
  type FakeFxRuntime,
  type FakeTarget,
  staticReducedMotion,
} from '../support/fakes';

installDom();

interface BoxProps extends FlareElementOptions {
  platform: ElementPlatform;
  probe(handle: FlareElementHandle): void;
}

function Box({ platform, probe, ...options }: BoxProps): ReactNode {
  const handle = useFlareElement(options, platform);
  probe(handle);
  return <div data-box="" data-phase={handle.phase} data-hold={String(handle.holdSpace)} />;
}

interface Harness {
  driver: FakeDriver;
  target: FakeTarget;
  fx: FakeFxRuntime;
  platform: ElementPlatform;
  onEntered: ReturnType<typeof mock<() => void>>;
  onExited: ReturnType<typeof mock<(finished: boolean) => void>>;
  /** The phase of every render, oldest first. */
  phases: FlareElementHandle['phase'][];
  handle(): FlareElementHandle;
  /** The tree with the element under key "a", or without it. */
  tree(show: boolean, options?: FlareElementOptions, platform?: ElementPlatform): ReactNode;
  mount(options?: FlareElementOptions): Rendered;
}

const rendered: Rendered[] = [];

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

function harness(
  over: Partial<FlareContextValue> = {},
  targetOptions?: Parameters<typeof createFakeTarget>[0],
): Harness {
  const driver = createFakeDriver();
  const target = createFakeTarget(targetOptions);
  const fx = createFakeFxRuntime();
  const ctx: FlareContextValue = {
    registry: createPresetRegistry(),
    reducedMotion: staticReducedMotion(false),
    fx,
    overlay: null,
    hostFactory: null,
    rtl: false,
    ...over,
  };
  const platform: ElementPlatform = { driver, target, size: () => ({ w: 100, h: 40 }) };
  let latest: FlareElementHandle | null = null;
  const h: Harness = {
    driver,
    target,
    fx,
    platform,
    onEntered: mock(() => {}),
    onExited: mock((_finished: boolean) => {}),
    phases: [],
    handle() {
      if (latest === null) throw new Error('the element has not rendered');
      return latest;
    },
    tree(show, options = {}, elementPlatform = platform) {
      return (
        <FlareContext.Provider value={ctx}>
          <FlarePresence>
            {show ? (
              <Box
                key="a"
                platform={elementPlatform}
                probe={(handle) => {
                  latest = handle;
                  h.phases.push(handle.phase);
                }}
                onEntered={h.onEntered}
                onExited={h.onExited}
                {...options}
              />
            ) : null}
          </FlarePresence>
        </FlareContext.Provider>
      );
    },
    mount(options) {
      const r = render(h.tree(true, options));
      rendered.push(r);
      return r;
    },
  };
  return h;
}

/** Lets pending promises (a measure, a capture) resolve and flushes the React work they cause. */
const settle = (): Promise<void> =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const boxes = (r: Rendered): Element[] => [...r.container.querySelectorAll('[data-box]')];
const phaseOf = (r: Rendered): string | null => boxes(r)[0]?.getAttribute('data-phase') ?? null;

test('enter plays on mount, onEntered after end', () => {
  const h = harness();
  const r = h.mount({ enter: fade() });

  expect(h.driver.plays).toHaveLength(1);
  expect(h.driver.plays[0]!.direction).toBe(1);
  expect(phaseOf(r)).toBe('entering');
  expect(h.onEntered).not.toHaveBeenCalled();

  act(() => h.driver.end(true));
  expect(h.onEntered).toHaveBeenCalledTimes(1);
  expect(phaseOf(r)).toBe('present');
});

test('live exit keeps child until end', () => {
  const h = harness();
  const options = { exit: fade() };
  const r = h.mount(options);
  expect(h.driver.plays).toHaveLength(0);
  expect(phaseOf(r)).toBe('present');

  r.rerender(h.tree(false, options));
  expect(boxes(r)).toHaveLength(1);
  expect(h.driver.plays).toHaveLength(1);
  expect(h.driver.plays[0]!.direction).toBe(-1);
  expect(h.onExited).not.toHaveBeenCalled();

  act(() => h.driver.end(true));
  expect(boxes(r)).toHaveLength(0);
  expect(h.onExited.mock.calls).toEqual([[true]]);
});

test('re-adding during live exit reverses', () => {
  const h = harness();
  const options = { exit: fade() };
  const r = h.mount(options);
  const node = boxes(r)[0];

  r.rerender(h.tree(false, options));
  r.rerender(h.tree(true, options));
  expect(h.driver.reversed).toBe(1);
  expect(h.onExited.mock.calls).toEqual([[false]]);
  expect(boxes(r)[0]).toBe(node);
  expect(phaseOf(r)).toBe('present');

  // The reversed animation ending is not the exit ending.
  act(() => h.driver.end(true));
  expect(boxes(r)).toHaveLength(1);
  expect(h.onExited).toHaveBeenCalledTimes(1);
});

test('snapshot exit releases at handoff, onExited at end', async () => {
  const h = harness();
  const options = { exit: shatter() };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.fx.runs[0]!.options.direction).toBe(-1);
  expect(h.driver.plays).toHaveLength(0);
  expect(boxes(r)).toHaveLength(1);

  act(() => h.fx.handoff());
  expect(boxes(r)).toHaveLength(0);
  expect(h.onExited).not.toHaveBeenCalled();

  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
});

test('holdSpace keeps placeholder until end', async () => {
  const h = harness();
  const options = { exit: shatter(), holdSpace: true };
  const r = h.mount(options);
  expect(boxes(r)[0]!.getAttribute('data-hold')).toBe('false');

  r.rerender(h.tree(false, options));
  await settle();
  act(() => h.fx.handoff());
  expect(boxes(r)).toHaveLength(1);
  expect(boxes(r)[0]!.getAttribute('data-hold')).toBe('true');
  expect(phaseOf(r)).toBe('exiting');
  expect(h.target.hidden.value).toBe(1);
  expect(h.onExited).not.toHaveBeenCalled();

  act(() => h.fx.end(true));
  expect(boxes(r)).toHaveLength(0);
  expect(h.onExited.mock.calls).toEqual([[true]]);
});

test('holdSpace: a key that returns after handoff is shown again at the end', async () => {
  const h = harness();
  const options = { exit: shatter(), holdSpace: true };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  await settle();
  act(() => h.fx.handoff());
  r.rerender(h.tree(true, options));
  expect(h.fx.runs[0]!.cancelled).toBe(false);
  expect(h.onExited).not.toHaveBeenCalled();

  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(boxes(r)).toHaveLength(1);
  expect(h.target.hidden.value).toBe(0);
  expect(boxes(r)[0]!.getAttribute('data-hold')).toBe('false');
  expect(phaseOf(r)).toBe('present');
});

test('cancel before handoff restores element', async () => {
  const h = harness();
  const options = { exit: shatter() };
  const r = h.mount(options);
  const node = boxes(r)[0];

  r.rerender(h.tree(false, options));
  await settle();
  r.rerender(h.tree(true, options));

  expect(h.fx.runs).toHaveLength(1);
  expect(h.fx.runs[0]!.cancelResults).toEqual([true]);
  expect(boxes(r)[0]).toBe(node);
  expect(phaseOf(r)).toBe('present');
  expect(h.target.hidden.value).toBe(0);
  // The cancelled run's own onEnd(false) has already arrived and added nothing.
  expect(h.onExited.mock.calls).toEqual([[false]]);
});

test('same key returns after handoff enters fresh', async () => {
  const h = harness();
  const options = { enter: fade(), exit: shatter() };
  const r = h.mount(options);
  act(() => h.driver.end(true));
  const first = boxes(r)[0];

  r.rerender(h.tree(false, options));
  await settle();
  act(() => h.fx.handoff());
  expect(boxes(r)).toHaveLength(0);

  const second = createFakeDriver();
  r.rerender(h.tree(true, options, { ...h.platform, driver: second }));
  expect(second.plays).toHaveLength(1);
  expect(second.plays[0]!.direction).toBe(1);
  expect(h.driver.plays).toHaveLength(1);
  expect(h.fx.runs[0]!.cancelResults).toEqual([]);
  expect(boxes(r)).toHaveLength(1);
  expect(boxes(r)[0]).not.toBe(first);

  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(boxes(r)).toHaveLength(1);
  expect(phaseOf(r)).toBe('entering');
});

test('a key back between the runtime handoff and onHandoff is held, then shown at the end', async () => {
  const h = harness();
  const options = { exit: shatter() };
  const r = h.mount(options);
  r.rerender(h.tree(false, options));
  await settle();
  const run = h.fx.runs[0]!;
  // A native runtime hands off on the UI thread; its onHandoff reaches JS a moment later.
  run.handedOff = true;
  run.target.hidden.value = 1;
  r.rerender(h.tree(true, options));
  expect(run.cancelResults).toEqual([false]);

  act(() => run.options.onHandoff());
  expect(boxes(r)).toHaveLength(1);
  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(h.target.hidden.value).toBe(0);
  expect(phaseOf(r)).toBe('present');

  r.rerender(h.tree(false, options));
  expect(phaseOf(r)).toBe('exiting');
  await settle();
  expect(h.fx.runs).toHaveLength(2);
});

test('capture resolves after unmount: nothing drawn, no throw', async () => {
  const h = harness({}, { deferCapture: true });
  const options = { exit: shatter() };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.target.captures).toHaveLength(1);

  // An ancestor takes the whole subtree away while the capture is in flight.
  r.rerender(null);
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(h.fx.runs[0]!.cancelResults).toEqual([true]);

  h.target.landCaptures();
  await settle();
  expect(h.fx.runs[0]!.mounted).toBe(false);
  expect(h.fx.runs[0]!.handedOff).toBe(false);
  expect(h.target.hidden.value).toBe(0);
  expect(h.target.hideSyncs).toBe(0);
  expect(h.onExited).toHaveBeenCalledTimes(1);
});

test('ancestor unmount during the measure starts no run', async () => {
  const h = harness();
  const options = { exit: shatter() };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  r.rerender(null);
  expect(h.onExited.mock.calls).toEqual([[true]]);

  await settle();
  expect(h.fx.runs).toHaveLength(0);
  expect(h.target.captures).toHaveLength(0);
  expect(h.onExited).toHaveBeenCalledTimes(1);
});

test('ancestor unmount ends a live exit at once', () => {
  const h = harness();
  const options = { exit: fade() };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  expect(h.driver.disposed).toBe(0);
  r.rerender(null);
  expect(h.driver.disposed).toBe(1);
  expect(h.onExited.mock.calls).toEqual([[true]]);

  act(() => h.driver.end(true));
  expect(h.onExited).toHaveBeenCalledTimes(1);
});

test('ancestor unmount after handoff leaves the overlay running', async () => {
  for (const holdSpace of [false, true]) {
    const h = harness();
    const options = { exit: shatter(), holdSpace };
    const r = h.mount(options);

    r.rerender(h.tree(false, options));
    await settle();
    act(() => h.fx.handoff());
    r.rerender(null);
    expect(h.fx.runs[0]!.cancelResults).toEqual([]);
    expect(h.onExited).not.toHaveBeenCalled();

    act(() => h.fx.end(true));
    expect(h.onExited.mock.calls).toEqual([[true]]);
  }
});

test('phase is exiting from the removing render until release', async () => {
  const h = harness();
  const options = { exit: shatter() };
  const r = h.mount(options);
  expect(h.phases.at(-1)).toBe('present');

  const before = h.phases.length;
  r.rerender(h.tree(false, options));
  // The very first render without the child already reports it, before any effect has run.
  expect(h.phases[before]).toBe('exiting');
  await settle();
  expect(h.phases.slice(before).every((phase) => phase === 'exiting')).toBe(true);
  expect(phaseOf(r)).toBe('exiting');

  act(() => h.fx.handoff());
  expect(boxes(r)).toHaveLength(0);
  expect(h.phases.slice(before).every((phase) => phase === 'exiting')).toBe(true);
});

test('phase returns to present when the element re-presents', () => {
  const h = harness();
  const options = { exit: fade() };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  expect(phaseOf(r)).toBe('exiting');
  r.rerender(h.tree(true, options));
  expect(phaseOf(r)).toBe('present');
});

test('zero-size or null measure exits immediately', async () => {
  for (const rect of [
    null,
    { x: 0, y: 0, width: 0, height: 20 },
    { x: 0, y: 0, width: 20, height: 0 },
  ]) {
    const h = harness({}, { rect });
    const options = { exit: shatter() };
    const r = h.mount(options);

    r.rerender(h.tree(false, options));
    await settle();
    expect(h.fx.runs).toHaveLength(0);
    expect(h.target.captures).toHaveLength(0);
    expect(h.driver.plays).toHaveLength(0);
    expect(boxes(r)).toHaveLength(0);
    expect(h.onExited.mock.calls).toEqual([[true]]);
  }
});

test('no fx runtime → live fallback + one warning', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    for (let i = 0; i < 2; i++) {
      const h = harness({ fx: null });
      const options = { exit: shatter() };
      const r = h.mount(options);

      r.rerender(h.tree(false, options));
      expect(h.driver.plays).toHaveLength(1);
      expect(h.driver.plays[0]!.direction).toBe(-1);
      // The default fallback, fade({ opacity: 0, duration: 0.15 }).
      expect(h.driver.plays[0]!.c.kind).toBe(0);
      expect(h.driver.plays[0]!.c.duration).toBeCloseTo(0.15, 6);
      expect(h.target.captures).toHaveLength(0);
      expect(boxes(r)).toHaveLength(1);

      act(() => h.driver.end(true));
      expect(boxes(r)).toHaveLength(0);
      expect(h.onExited.mock.calls).toEqual([[true]]);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('FlareFxHost');
  } finally {
    warn.mockRestore();
  }
});

test('reduced motion system=true → fallback; never → snapshot', async () => {
  const reduced = harness({ reducedMotion: staticReducedMotion(true) });
  const fallbackOptions = { exit: shatter({ fallback: fade({ opacity: 0.5, duration: 0.2 }) }) };
  const r = reduced.mount(fallbackOptions);
  r.rerender(reduced.tree(false, fallbackOptions));
  await settle();
  expect(reduced.fx.runs).toHaveLength(0);
  expect(reduced.driver.plays).toHaveLength(1);
  expect(reduced.driver.plays[0]!.c.duration).toBeCloseTo(0.2, 6);

  const never = harness({ reducedMotion: staticReducedMotion(true) });
  const neverOptions: FlareElementOptions = { exit: shatter(), reduceMotion: 'never' };
  const r2 = never.mount(neverOptions);
  r2.rerender(never.tree(false, neverOptions));
  await settle();
  expect(never.fx.runs).toHaveLength(1);
  expect(never.driver.plays).toHaveLength(0);

  const always = harness();
  const alwaysOptions: FlareElementOptions = { exit: shatter(), reduceMotion: 'always' };
  const r3 = always.mount(alwaysOptions);
  r3.rerender(always.tree(false, alwaysOptions));
  await settle();
  expect(always.fx.runs).toHaveLength(0);
  expect(always.driver.plays).toHaveLength(1);
});

test('external progress is passed to driver and fx', async () => {
  const h = harness();
  const progress = { value: 0.3 };
  const options = { enter: fade(), exit: shatter(), progress };
  const r = h.mount(options);
  expect(h.driver.plays[0]!.progress).toBe(progress);

  r.rerender(h.tree(false, options));
  await settle();
  expect(h.fx.runs[0]!.options.progress).toBe(progress);
});

test('exitOn press plays exit then onExited', () => {
  const h = harness();
  const options: FlareElementOptions = { exit: fade(), press: press(), exitOn: 'press' };
  const r = h.mount(options);

  act(() => h.handle().onPressIn({ x: 10, y: 5 }));
  expect(h.driver.presses).toHaveLength(1);
  expect(h.driver.presses[0]!.pressed).toBe(true);
  expect(h.driver.presses[0]!.c?.kind).toBe(3);
  act(() => h.handle().onPressOut());
  expect(h.driver.presses[1]).toEqual({ pressed: false, c: null });
  expect(h.driver.plays).toHaveLength(0);

  act(() => h.handle().onPress());
  expect(phaseOf(r)).toBe('exiting');
  expect(h.driver.plays).toHaveLength(1);
  expect(h.driver.plays[0]!.direction).toBe(-1);
  expect(h.onExited).not.toHaveBeenCalled();

  act(() => h.driver.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(phaseOf(r)).toBe('released');
});

test('a press exit inside FlarePresence unmounts once the caller drops the item', () => {
  const h = harness();
  const options: FlareElementOptions = { exit: fade(), exitOn: 'press' };
  const r = h.mount(options);
  act(() => h.handle().onPress());
  act(() => h.driver.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(boxes(r)).toHaveLength(1);

  r.rerender(h.tree(false, options));
  expect(boxes(r)).toHaveLength(0);
});

test('a snapshot press exit inside FlarePresence unmounts once the caller drops the item', async () => {
  const h = harness();
  const options: FlareElementOptions = { exit: shatter(), exitOn: 'press' };
  const r = h.mount(options);
  act(() => h.handle().onPressIn({ x: 1, y: 1 }));
  act(() => h.handle().onPress());
  await settle();
  act(() => h.fx.handoff());
  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);

  r.rerender(h.tree(false, options));
  expect(boxes(r)).toHaveLength(0);
});

test('timeline: live entries then fx.run at the snapshot start', async () => {
  const h = harness();
  const options = { exit: sequence(fade({ opacity: 0.7, duration: 0.06 }), disintegrate()) };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  await settle();
  expect(h.driver.plays).toHaveLength(1);
  expect(h.driver.plays[0]!.direction).toBe(-1);
  expect(h.driver.plays[0]!.c.duration).toBeCloseTo(0.06, 6);
  expect(h.fx.runs).toHaveLength(0);
  expect(h.target.captures).toHaveLength(0);

  act(() => h.driver.end(true));
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.fx.runs[0]!.preset.kind).toBe('disintegrate');
  expect(boxes(r)).toHaveLength(1);

  act(() => h.fx.handoff());
  expect(boxes(r)).toHaveLength(0);
  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
});

test('timeline: a gap before the snapshot step is held by the driver', () => {
  const h = harness();
  const options = {
    exit: sequence(fade({ opacity: 0.7, duration: 0.06 }), delay(0.1), dust()),
  };
  const r = h.mount(options);
  r.rerender(h.tree(false, options));
  // Both fades are over by 0.1 s, the snapshot step starts at 0.16 s.
  expect(h.driver.plays[0]!.c.duration).toBeCloseTo(0.16, 6);
});

test('timeline without a snapshot entry is all live', () => {
  const h = harness();
  const options = {
    exit: sequence(fade({ opacity: 0.7, duration: 0.06 }), fade({ duration: 0.1 })),
  };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  expect(h.driver.plays).toHaveLength(1);
  expect(h.driver.plays[0]!.c.duration).toBeCloseTo(0.16, 6);

  act(() => h.driver.end(true));
  expect(h.fx.runs).toHaveLength(0);
  expect(boxes(r)).toHaveLength(0);
  expect(h.onExited.mock.calls).toEqual([[true]]);
});

test('re-adding during a timeline lead-in reverses and starts no run', async () => {
  const h = harness();
  const options = { exit: sequence(fade({ opacity: 0.7, duration: 0.06 }), disintegrate()) };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  r.rerender(h.tree(true, options));
  expect(h.driver.reversed).toBe(1);
  expect(h.onExited.mock.calls).toEqual([[false]]);

  act(() => h.driver.end(true));
  await settle();
  expect(h.fx.runs).toHaveLength(0);
  expect(boxes(r)).toHaveLength(1);
});

test('onFallback mid-capture plays the live fallback', async () => {
  const h = harness({}, { deferCapture: true });
  const options = { exit: shatter() };
  const r = h.mount(options);

  r.rerender(h.tree(false, options));
  await settle();
  expect(h.driver.plays).toHaveLength(0);

  act(() => h.fx.fallback());
  expect(h.driver.plays).toHaveLength(1);
  expect(h.driver.plays[0]!.direction).toBe(-1);
  expect(h.driver.plays[0]!.c.duration).toBeCloseTo(0.15, 6);
  expect(boxes(r)).toHaveLength(1);
  expect(h.onExited).not.toHaveBeenCalled();

  act(() => h.driver.end(true));
  expect(boxes(r)).toHaveLength(0);
  expect(h.onExited.mock.calls).toEqual([[true]]);
});

test('exitOn press captures at press-in and reuses it on release', async () => {
  const h = harness();
  const options: FlareElementOptions = { exit: shatter(), exitOn: 'press' };
  const r = h.mount(options);

  act(() => h.handle().onPressIn({ x: 10, y: 5 }));
  await settle();
  expect(h.target.captures).toEqual([2048]);
  expect(h.fx.runs).toHaveLength(0);

  // React Native reports the press-out before the press itself.
  act(() => h.handle().onPressOut());
  act(() => h.handle().onPress());
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.fx.runs[0]!.image).toBe(h.target.images[0]!);
  expect(h.fx.runs[0]!.options.press).toEqual({ x: 10, y: 5 });
  expect(h.target.captures).toHaveLength(1);
  expect(h.target.measures).toBe(1);

  act(() => h.fx.handoff());
  expect(h.target.hidden.value).toBe(1);
  expect(h.target.hideSyncs).toBe(1);
  act(() => h.fx.end(true));
  expect(h.onExited.mock.calls).toEqual([[true]]);
  expect(phaseOf(r)).toBe('released');
});

test('exitOn press: a release before the capture lands waits for it', async () => {
  const h = harness({}, { deferCapture: true });
  const options: FlareElementOptions = { exit: shatter(), exitOn: 'press' };
  const r = h.mount(options);

  act(() => h.handle().onPressIn(null));
  act(() => h.handle().onPress());
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.fx.runs[0]!.mounted).toBe(false);
  expect(h.target.hidden.value).toBe(0);
  expect(boxes(r)).toHaveLength(1);

  h.target.landCaptures();
  await settle();
  expect(h.fx.runs[0]!.mounted).toBe(true);
  expect(h.fx.runs[0]!.image).toBe(h.target.images[0]!);
  expect(h.target.captures).toHaveLength(1);
});

test('cancelled press discards the prepared capture', async () => {
  const h = harness();
  const options: FlareElementOptions = { exit: shatter(), exitOn: 'press' };
  const r = h.mount(options);

  act(() => h.handle().onPressIn({ x: 10, y: 5 }));
  await settle();
  act(() => h.handle().onPressOut());
  expect(h.target.captures).toHaveLength(1);
  expect(h.fx.runs).toHaveLength(0);
  expect(phaseOf(r)).toBe('present');

  // A later exit that no press started takes its own capture, and no press point.
  r.rerender(h.tree(false, options));
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.target.captures).toHaveLength(2);
  expect(h.fx.runs[0]!.image).toBe(h.target.images[1]!);
  expect(h.fx.runs[0]!.options.press).toBeNull();
});

test('prepare() holds a capture for the next play()', async () => {
  const h = harness();
  h.mount();

  let ready = false;
  await act(async () => {
    ready = await h.handle().prepare();
  });
  expect(ready).toBe(true);
  expect(h.target.captures).toEqual([2048]);

  const results: boolean[] = [];
  act(() => {
    h.handle()
      .play(shatter())
      .then((value) => {
        results.push(value);
      });
  });
  await settle();
  expect(h.fx.runs).toHaveLength(1);
  expect(h.target.captures).toHaveLength(1);

  act(() => h.fx.handoff());
  act(() => h.fx.end(true));
  await settle();
  expect(results).toEqual([true]);
  expect(h.onExited).not.toHaveBeenCalled();
});

test('onFx reports the start and end of each cause', () => {
  const h = harness();
  const events: string[] = [];
  const options: FlareElementOptions = {
    enter: fade(),
    exit: fade(),
    onFx: (e) => events.push(`${e.cause}:${e.phase}:${e.finished}`),
  };
  const r = h.mount(options);
  act(() => h.driver.end(true));
  r.rerender(h.tree(false, options));
  act(() => h.driver.end(true));
  expect(events).toEqual([
    'enter:start:false',
    'enter:end:true',
    'exit:start:false',
    'exit:end:true',
  ]);
});

test('a removed element without an exit preset is released at once', () => {
  const h = harness();
  const r = h.mount();
  r.rerender(h.tree(false));
  expect(boxes(r)).toHaveLength(0);
  expect(h.onExited.mock.calls).toEqual([[true]]);
});
