import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { type CompiledLive, compileLive } from '../../src/core/live';
import { fade, flip, press, slide } from '../../src/core/presets';
import type { LiveDriver } from '../../src/runtime/contracts';
import { installDom, type Rendered, render } from '../support/dom';
import { installReanimatedMock } from '../support/mock-reanimated';
import { installRnMock } from '../support/mock-rn';

installDom();
installRnMock();
const reanimated = installReanimatedMock();

// Loaded after the mocks, so the driver never reaches the real Reanimated.
const { useNativeLiveDriver } = await import('../../src/native/live-driver');

interface Style {
  opacity: number;
  transform: Record<string, number | string>[];
}

const TRANSFORM_KEYS = [
  'perspective',
  'translateX',
  'translateY',
  'rotateX',
  'rotateY',
  'rotate',
  'scale',
];

const compiled = (preset: Parameters<typeof compileLive>[0]): CompiledLive =>
  compileLive(preset, 100, 40, false);

const rendered: Rendered[] = [];

beforeEach(() => {
  reanimated.reset();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

interface Harness {
  driver: LiveDriver;
  /** Every driver object a render returned. */
  drivers: LiveDriver[];
  /** The style, evaluated now. */
  style(): Style;
  rerender(): void;
}

function mount(hiddenUntilPlay?: boolean): Harness {
  const drivers: LiveDriver[] = [];
  let styleProp: unknown = null;
  function Probe(): ReactNode {
    const { driver, style } = useNativeLiveDriver(hiddenUntilPlay);
    drivers.push(driver);
    styleProp = style;
    return null;
  }
  const r = render(<Probe />);
  rendered.push(r);
  return {
    driver: drivers[0]!,
    drivers,
    style: () => reanimated.styleOf(styleProp) as unknown as Style,
    rerender: () => r.rerender(<Probe />),
  };
}

const keysOf = (style: Style): string[] => style.transform.map((entry) => Object.keys(entry)[0]!);

const transformValue = (style: Style, key: string): number | string => {
  const entry = style.transform.find((candidate) => key in candidate);
  if (entry === undefined) throw new Error(`no ${key} in the transform list`);
  return entry[key]!;
};

test('at rest the style is opaque, with the full identity transform list', () => {
  const h = mount();
  expect(h.style()).toEqual({
    opacity: 1,
    transform: [
      { perspective: 100000 },
      { translateX: 0 },
      { translateY: 0 },
      { rotateX: '0deg' },
      { rotateY: '0deg' },
      { rotate: '0deg' },
      { scale: 1 },
    ],
  });
});

test('hidden until its first play, the style is transparent from the first render', () => {
  const h = mount(true);
  expect(h.style().opacity).toBe(0);
  expect(h.driver.hidden.value).toBe(1);

  act(() => h.driver.play(compiled(slide({ from: 'bottom', distance: 30 })), 1, { onEnd() {} }));
  const style = h.style();
  expect(style.opacity).toBe(1);
  expect(transformValue(style, 'translateY')).toBe(30);
  expect(h.driver.hidden.value).toBe(0);
});

test('a play clears only the hide it was made with, never one set on hidden later', () => {
  const h = mount(true);
  act(() => h.driver.play(compiled(fade()), 1, { onEnd() {} }));
  act(() => reanimated.flush());
  expect(h.style().opacity).toBe(1);

  h.driver.hidden.value = 1;
  act(() => h.driver.play(compiled(fade()), -1, { onEnd() {} }));
  expect(h.style().opacity).toBe(0);
  expect(h.driver.hidden.value).toBe(1);
});

test('a driver made without it shows its rest pose before any play', () => {
  const h = mount(false);
  expect(h.style().opacity).toBe(1);
  expect(h.driver.hidden.value).toBe(0);
});

test('an entering fade is transparent at t = 0 and opaque after the timing ends', () => {
  const h = mount();
  const onEnd = mock((_finished: boolean) => {});
  act(() => h.driver.play(compiled(fade()), 1, { onEnd }));

  expect(h.style().opacity).toBe(0);
  expect(onEnd).not.toHaveBeenCalled();

  act(() => reanimated.flush());
  expect(h.style().opacity).toBe(1);
  expect(onEnd.mock.calls).toEqual([[true]]);
});

test('t runs from 0 to the duration, linearly, over duration × 1000 ms', () => {
  const h = mount();
  act(() => h.driver.play(compiled(fade({ duration: 0.4 })), -1, { onEnd() {} }));

  expect(reanimated.timings).toHaveLength(1);
  const timing = reanimated.timings[0]!;
  expect(timing.from).toBe(0);
  expect(timing.toValue).toBeCloseTo(0.4, 6);
  expect(timing.duration).toBeCloseTo(400, 3);
  expect(timing.easing).toBe(reanimated.linear);
});

test('the transform list keeps its seven entries across frames and presets', () => {
  const h = mount();
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);

  act(() => h.driver.play(compiled(fade()), 1, { onEnd() {} }));
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
  act(() => reanimated.advance(0.5));
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);

  act(() => h.driver.play(compiled(slide({ from: 'right' })), -1, { onEnd() {} }));
  act(() => reanimated.advance(0.5));
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
  act(() => reanimated.flush());
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
});

test('a preset without 3D gets perspective 100000', () => {
  const h = mount();
  const c = compiled(slide({ from: 'right' }));
  expect(c.uses3d).toBe(false);
  act(() => h.driver.play(c, 1, { onEnd() {} }));
  expect(transformValue(h.style(), 'perspective')).toBe(100000);
});

test('a flip and a fade both keep the seven-entry transform list', () => {
  const h = mount();
  act(() => h.driver.play(compiled(flip()), 1, { onEnd() {} }));
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
  act(() => reanimated.advance(0.5));
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
  act(() => reanimated.flush());
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);

  act(() => h.driver.play(compiled(fade()), -1, { onEnd() {} }));
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
  act(() => reanimated.flush());
  expect(keysOf(h.style())).toEqual(TRANSFORM_KEYS);
});

test('an entering flip starts edge-on and invisible at its perspective, and ends flat', () => {
  const h = mount();
  const c = compiled(flip());
  expect(c.uses3d).toBe(true);
  act(() => h.driver.play(c, 1, { onEnd() {} }));
  expect(transformValue(h.style(), 'perspective')).toBe(800);
  expect(transformValue(h.style(), 'rotateY')).toBe('90deg');
  expect(transformValue(h.style(), 'rotateX')).toBe('0deg');
  expect(h.style().opacity).toBeCloseTo(0, 6);

  act(() => reanimated.flush());
  expect(transformValue(h.style(), 'perspective')).toBe(800);
  expect(transformValue(h.style(), 'rotateY')).toBe('0deg');
  expect(h.style().opacity).toBe(1);
});

test('a flip about the x axis turns rotateX, and a fade after it is flat again', () => {
  const h = mount();
  act(() => h.driver.play(compiled(flip({ axis: 'x', angle: -90 })), -1, { onEnd() {} }));
  act(() => reanimated.flush());
  expect(transformValue(h.style(), 'rotateX')).toBe('-90deg');
  expect(transformValue(h.style(), 'rotateY')).toBe('0deg');

  act(() => h.driver.play(compiled(fade()), 1, { onEnd() {} }));
  expect(transformValue(h.style(), 'perspective')).toBe(100000);
  expect(transformValue(h.style(), 'rotateX')).toBe('0deg');
});

test('an entering slide starts at its distance and ends at rest', () => {
  const h = mount();
  act(() => h.driver.play(compiled(slide({ from: 'right', distance: 48 })), 1, { onEnd() {} }));
  expect(transformValue(h.style(), 'translateX')).toBeCloseTo(48, 6);
  expect(transformValue(h.style(), 'translateY')).toBeCloseTo(0, 6);

  act(() => reanimated.flush());
  expect(transformValue(h.style(), 'translateX')).toBeCloseTo(0, 6);
});

test('hidden.value = 1 yields opacity 0 in the same style evaluation', () => {
  const h = mount();
  expect(h.style().opacity).toBe(1);
  h.driver.hidden.value = 1;
  expect(h.style().opacity).toBe(0);
  h.driver.hidden.value = 0;
  expect(h.style().opacity).toBe(1);
});

test('hideSync is a no-op: the shared value is already live', () => {
  const h = mount();
  h.driver.hidden.value = 1;
  h.driver.hideSync();
  expect(h.driver.hidden.value).toBe(1);
  expect(reanimated.timings).toEqual([]);
});

test('pressT drives scale 0.96 while pressed, and back to 1 on release', () => {
  const h = mount();
  const pose = compiled(press({ scale: 0.96 }));
  act(() => h.driver.setPressed(true, pose));
  expect(transformValue(h.style(), 'scale')).toBe(1);
  expect(reanimated.timings.at(-1)).toMatchObject({ from: 0, toValue: 1, finished: null });
  expect(reanimated.timings.at(-1)!.duration).toBeCloseTo(120, 3);

  act(() => reanimated.flush());
  expect(transformValue(h.style(), 'scale')).toBeCloseTo(0.96, 6);

  act(() => h.driver.setPressed(false, null));
  expect(reanimated.timings.at(-1)).toMatchObject({ from: 1, toValue: 0 });
  act(() => reanimated.flush());
  expect(transformValue(h.style(), 'scale')).toBe(1);
});

test('the press pose multiplies the pose of the running preset', () => {
  const h = mount();
  act(() => h.driver.play(compiled(fade({ opacity: 0.5 })), -1, { onEnd() {} }));
  act(() => h.driver.setPressed(true, compiled(press({ scale: 0.9, opacity: 0.5 }))));
  act(() => reanimated.flush());

  expect(h.style().opacity).toBeCloseTo(0.25, 6);
  expect(transformValue(h.style(), 'scale')).toBeCloseTo(0.9, 6);
});

test('with progress, t is progress.value × duration and no timing runs', () => {
  const h = mount();
  const progress = { value: 0 };
  const onEnd = mock((_finished: boolean) => {});
  act(() =>
    h.driver.play(compiled(slide({ from: 'right', distance: 48 })), -1, { progress, onEnd }),
  );

  expect(reanimated.timings).toEqual([]);
  expect(transformValue(h.style(), 'translateX')).toBeCloseTo(0, 6);
  progress.value = 1;
  expect(transformValue(h.style(), 'translateX')).toBeCloseTo(48, 6);
  progress.value = 0;
  expect(transformValue(h.style(), 'translateX')).toBeCloseTo(0, 6);
  expect(onEnd).not.toHaveBeenCalled();
});

test('a play after a scrubbed one runs on its own clock again', () => {
  const h = mount();
  const progress = { value: 1 };
  act(() => h.driver.play(compiled(fade()), -1, { progress, onEnd() {} }));
  expect(h.style().opacity).toBe(0);

  act(() => h.driver.play(compiled(fade()), -1, { onEnd() {} }));
  expect(h.style().opacity).toBe(1);
  expect(reanimated.timings).toHaveLength(1);
});

test('reverse retraces the pose from where it is, and ends the play unfinished', () => {
  const h = mount();
  const onEnd = mock((_finished: boolean) => {});
  act(() => h.driver.play(compiled(fade({ duration: 0.4, easing: 'linear' })), -1, { onEnd }));
  act(() => reanimated.advance(0.25));
  expect(h.style().opacity).toBeCloseTo(0.75, 5);

  act(() => h.driver.reverse());
  expect(onEnd.mock.calls).toEqual([[false]]);
  expect(h.style().opacity).toBeCloseTo(0.75, 5);
  const back = reanimated.timings.at(-1)!;
  expect(back.from).toBeCloseTo(0.1, 6);
  expect(back.toValue).toBe(0);
  expect(back.duration).toBeCloseTo(100, 3);
  expect(back.easing).toBe(reanimated.linear);

  act(() => reanimated.flush());
  expect(h.style().opacity).toBe(1);
  expect(onEnd).toHaveBeenCalledTimes(1);
});

test('cancel holds the current pose and ends with finished false, once', () => {
  const h = mount();
  const onEnd = mock((_finished: boolean) => {});
  act(() => h.driver.play(compiled(fade({ duration: 0.4, easing: 'linear' })), -1, { onEnd }));
  act(() => reanimated.advance(0.5));

  act(() => h.driver.cancel());
  expect(onEnd.mock.calls).toEqual([[false]]);
  expect(h.style().opacity).toBeCloseTo(0.5, 5);

  act(() => {
    h.driver.cancel();
    reanimated.flush();
  });
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(h.style().opacity).toBeCloseTo(0.5, 5);
});

test('cancel ends a scrubbed play too', () => {
  const h = mount();
  const onEnd = mock((_finished: boolean) => {});
  act(() => h.driver.play(compiled(fade()), -1, { progress: { value: 0.5 }, onEnd }));
  act(() => h.driver.cancel());
  expect(onEnd.mock.calls).toEqual([[false]]);
});

test('a second play ends the first unfinished, and only the second finishes', () => {
  const h = mount();
  const first = mock((_finished: boolean) => {});
  const second = mock((_finished: boolean) => {});
  act(() => h.driver.play(compiled(fade()), 1, { onEnd: first }));
  act(() => h.driver.play(compiled(slide()), -1, { onEnd: second }));
  expect(first.mock.calls).toEqual([[false]]);
  expect(second).not.toHaveBeenCalled();

  act(() => reanimated.flush());
  expect(first).toHaveBeenCalledTimes(1);
  expect(second.mock.calls).toEqual([[true]]);
});

test('dispose stops the timing without calling onEnd', () => {
  const h = mount();
  const onEnd = mock((_finished: boolean) => {});
  act(() => h.driver.play(compiled(fade()), -1, { onEnd }));
  act(() => h.driver.dispose());
  expect(reanimated.timings[0]!.finished).toBe(false);

  act(() => reanimated.flush());
  expect(onEnd).not.toHaveBeenCalled();
});

test('the driver is the same object on every render', () => {
  const h = mount();
  act(() => h.driver.play(compiled(fade()), 1, { progress: { value: 0 }, onEnd() {} }));
  h.rerender();
  expect(h.drivers.length).toBeGreaterThan(1);
  for (const driver of h.drivers) expect(driver).toBe(h.driver);
});
