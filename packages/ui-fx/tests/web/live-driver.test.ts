import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CompiledLive,
  compileLive,
  LIVE_POSE_STRIDE,
  sampleLivePosesInto,
} from '../../src/core/live';
import { emerge, fade, press, slide } from '../../src/core/presets';
import type { LiveDriver } from '../../src/runtime/contracts';
import { flipReflow } from '../../src/web/flip';
import { createWebLiveDriver, poseRowsToKeyframes } from '../../src/web/live-driver';
import { flushFrames, installDom } from '../support/dom';
import { installFakeAnimate } from '../support/fake-animate';

installDom();
const waapi = installFakeAnimate();

const compiled = (preset: Parameters<typeof compileLive>[0]): CompiledLive =>
  compileLive(preset, 100, 40, false);

const elements: HTMLElement[] = [];

function mount(): { el: HTMLElement; driver: LiveDriver } {
  const el = document.createElement('div');
  document.body.appendChild(el);
  elements.push(el);
  return { el, driver: createWebLiveDriver(el) };
}

/** Lets the promise chain behind `finished` run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** One pose row: tx, ty, rotation, rotateX, rotateY, perspective, scale, opacity, brightness. */
const row = (values: Partial<Record<number, number>>): number[] => {
  const out = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0];
  for (const [index, value] of Object.entries(values)) out[Number(index)] = value!;
  return out;
};

/** The factor of a `scale(S)` keyframe. The press scale is stored as a Float32, so it is not exact. */
const scaleOf = (frame: Keyframe): number => Number(String(frame.transform).slice(6, -1));

beforeEach(() => {
  waapi.reset();
});

afterEach(async () => {
  for (const el of elements.splice(0)) el.remove();
  // Drains any frame a test left requested.
  await flushFrames(1);
});

test('2D rows become translate, rotate and scale keyframes, and opacity-only paint keyframes', () => {
  const rows = new Float32Array([...row({ 0: 48, 1: -8, 2: 90, 6: 0.5, 7: 0.25 }), ...row({})]);
  expect(poseRowsToKeyframes(rows, 2)).toEqual({
    transform: [
      { transform: 'translate(48px, -8px) rotate(90deg) scale(0.5)' },
      { transform: 'translate(0px, 0px) rotate(0deg) scale(1)' },
    ],
    paint: [{ opacity: 0.25 }, { opacity: 1 }],
  });
});

test('only the first count rows are read', () => {
  const rows = new Float32Array([...row({ 0: 1 }), ...row({ 0: 2 }), ...row({ 0: 3 })]);
  const frames = poseRowsToKeyframes(rows, 2);
  expect(frames.transform).toHaveLength(2);
  expect(frames.paint).toHaveLength(2);
});

test('rows that use 3D give every keyframe the same six-function list', () => {
  const rows = new Float32Array([
    ...row({ 3: 90, 5: 800 }),
    ...row({ 4: 45, 5: 800 }),
    ...row({ 5: 800 }),
  ]);
  expect(poseRowsToKeyframes(rows, 3).transform).toEqual([
    {
      transform:
        'perspective(800px) translate(0px, 0px) rotateX(90deg) rotateY(0deg) rotate(0deg) scale(1)',
    },
    {
      transform:
        'perspective(800px) translate(0px, 0px) rotateX(0deg) rotateY(45deg) rotate(0deg) scale(1)',
    },
    {
      transform:
        'perspective(800px) translate(0px, 0px) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(1)',
    },
  ]);
});

test('rows that darken give every paint keyframe a brightness filter', () => {
  const rows = new Float32Array([...row({ 7: 0.5, 8: 0.75 }), ...row({})]);
  expect(poseRowsToKeyframes(rows, 2).paint).toEqual([
    { opacity: 0.5, filter: 'brightness(0.75)' },
    { opacity: 1, filter: 'brightness(1)' },
  ]);
});

test('a live emerge is played with the filter, a fade without it', () => {
  const { driver } = mount();
  driver.play(compiled(emerge({ variant: 'live' })), 1, { onEnd() {} });
  for (const frame of waapi.animations[1]!.keyframes) {
    expect(String(frame.filter)).toMatch(/^brightness\(/);
  }

  driver.play(compiled(fade()), 1, { onEnd() {} });
  for (const frame of waapi.animations[3]!.keyframes) expect('filter' in frame).toBe(false);
});

test('play(fade, 1) calls animate twice, with 16 keyframes for 0.25 s at 60 fps', () => {
  const { el, driver } = mount();
  const c = compiled(fade({ duration: 0.25 }));
  driver.play(c, 1, { onEnd() {} });

  expect(waapi.animations).toHaveLength(2);
  const [transform, paint] = waapi.animations;
  expect(transform!.target).toBe(el);
  expect(paint!.target).toBe(el);
  expect(transform!.keyframes).toHaveLength(16);
  expect(paint!.keyframes).toHaveLength(16);
  expect(transform!.options).toEqual({
    duration: 250,
    fill: 'both',
    easing: 'linear',
    composite: 'add',
  });
  expect(paint!.options).toEqual({
    duration: 250,
    fill: 'both',
    easing: 'linear',
    composite: 'replace',
  });

  expect(transform!.keyframes[0]!.transform).toBe('translate(0px, 0px) rotate(0deg) scale(1)');
  expect(paint!.keyframes[0]!.opacity).toBe(0);
  expect(paint!.keyframes[15]!.opacity).toBe(1);
});

test('the keyframes are the sampled poses of the direction played', () => {
  const { driver } = mount();
  const c = compiled(slide({ from: 'right', distance: 48, duration: 0.25 }));
  const rows = new Float32Array(16 * LIVE_POSE_STRIDE);

  driver.play(c, 1, { onEnd() {} });
  sampleLivePosesInto(c, 1, 60, rows);
  expect(waapi.animations[0]!.keyframes.map((frame) => frame.transform)).toEqual(
    poseRowsToKeyframes(rows, 16).transform.map((frame) => frame.transform),
  );
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(48px, 0px) rotate(0deg) scale(1)',
  );

  driver.play(c, -1, { onEnd() {} });
  sampleLivePosesInto(c, -1, 60, rows);
  expect(waapi.animations[2]!.keyframes.map((frame) => frame.transform)).toEqual(
    poseRowsToKeyframes(rows, 16).transform.map((frame) => frame.transform),
  );
  expect(waapi.animations[2]!.keyframes[15]!.transform).toBe(
    'translate(48px, 0px) rotate(0deg) scale(1)',
  );
});

test('each keyframe sits at the time its pose was sampled, the last at the end', () => {
  const { driver } = mount();
  // 0.26 s is 15.6 frames: 16 samples a frame apart, then one at the duration.
  driver.play(compiled(fade({ duration: 0.26 })), 1, { onEnd() {} });
  const offsets = waapi.animations[0]!.keyframes.map((frame) => frame.offset);
  expect(offsets).toHaveLength(17);
  expect(offsets[0]).toBe(0);
  expect(offsets[1]!).toBeCloseTo(1 / 60 / 0.26, 9);
  expect(offsets[15]!).toBeCloseTo(15 / 60 / 0.26, 9);
  expect(offsets[16]).toBe(1);
  expect(waapi.animations[1]!.keyframes.map((frame) => frame.offset)).toEqual(offsets);
});

test('onEnd(true) fires after both animations finish, not after one', async () => {
  const { driver } = mount();
  const onEnd = mock((_finished: boolean) => {});
  driver.play(compiled(fade()), 1, { onEnd });

  waapi.animations[0]!.finish();
  await settle();
  expect(onEnd).not.toHaveBeenCalled();

  waapi.animations[1]!.finish();
  await settle();
  expect(onEnd.mock.calls).toEqual([[true]]);
});

test('reverse() calls reverse() on both, and ends the play unfinished', async () => {
  const { driver } = mount();
  const onEnd = mock((_finished: boolean) => {});
  driver.play(compiled(fade()), -1, { onEnd });
  driver.reverse();

  expect(waapi.animations[0]!.calls).toEqual(['reverse']);
  expect(waapi.animations[1]!.calls).toEqual(['reverse']);
  expect(onEnd.mock.calls).toEqual([[false]]);

  // The reversed animations running back to the start report nothing more.
  for (const animation of waapi.animations) animation.finish();
  await settle();
  expect(onEnd).toHaveBeenCalledTimes(1);
});

test('cancel() pauses both, then calls onEnd(false), once', async () => {
  const { driver } = mount();
  const pausedAtEnd: string[][] = [];
  const onEnd = mock((_finished: boolean) => {
    pausedAtEnd.push(...waapi.animations.map((animation) => [...animation.calls]));
  });
  driver.play(compiled(fade()), -1, { onEnd });
  driver.cancel();

  expect(onEnd.mock.calls).toEqual([[false]]);
  expect(pausedAtEnd).toEqual([['pause'], ['pause']]);

  driver.cancel();
  for (const animation of waapi.animations) animation.finish();
  await settle();
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(waapi.animations[0]!.calls).toEqual(['pause']);
});

test('hidden.value = 1 plus hideSync() sets style.visibility to hidden, and 0 clears it', () => {
  const { el, driver } = mount();
  expect(driver.hidden.value).toBe(0);

  driver.hidden.value = 1;
  expect(el.style.visibility).toBe('');
  driver.hideSync();
  expect(el.style.visibility).toBe('hidden');

  driver.hidden.value = 0;
  driver.hideSync();
  expect(el.style.visibility).toBe('');
});

test('external progress sets currentTime = progress × duration per frame, while paused', async () => {
  const { driver } = mount();
  const progress = { value: 0.2 };
  const onEnd = mock((_finished: boolean) => {});
  driver.play(compiled(fade({ duration: 0.25 })), -1, { progress, onEnd });

  const [transform, paint] = waapi.animations;
  expect(transform!.calls).toEqual(['pause']);
  expect(paint!.calls).toEqual(['pause']);
  expect(transform!.currentTime).toBeCloseTo(50, 9);
  expect(paint!.currentTime).toBeCloseTo(50, 9);

  progress.value = 0.6;
  expect(transform!.currentTime).toBeCloseTo(50, 9);
  await flushFrames(1);
  expect(transform!.currentTime).toBeCloseTo(150, 9);
  expect(paint!.currentTime).toBeCloseTo(150, 9);

  progress.value = 1;
  await flushFrames(3);
  expect(transform!.currentTime).toBeCloseTo(250, 9);

  // A scrubbed play has no end of its own, and cannot be reversed.
  for (const animation of waapi.animations) animation.finish();
  await settle();
  driver.reverse();
  expect(onEnd).not.toHaveBeenCalled();
  expect(transform!.calls).toEqual(['pause']);
});

test('cancel ends a scrubbed play, and its progress stops being followed', async () => {
  const { driver } = mount();
  const progress = { value: 0.5 };
  const onEnd = mock((_finished: boolean) => {});
  driver.play(compiled(fade({ duration: 0.25 })), -1, { progress, onEnd });
  driver.cancel();
  expect(onEnd.mock.calls).toEqual([[false]]);

  progress.value = 1;
  await flushFrames(2);
  expect(waapi.animations[0]!.currentTime).toBeCloseTo(125, 9);
});

test('a play after a scrubbed one runs on its own clock again', async () => {
  const { driver } = mount();
  const progress = { value: 0.5 };
  driver.play(compiled(fade()), -1, { progress, onEnd() {} });
  const onEnd = mock((_finished: boolean) => {});
  driver.play(compiled(fade()), -1, { onEnd });

  const [, , transform, paint] = waapi.animations;
  expect(transform!.calls).toEqual([]);
  progress.value = 1;
  await flushFrames(2);
  expect(transform!.currentTime).toBe(0);

  transform!.finish();
  paint!.finish();
  await settle();
  expect(onEnd.mock.calls).toEqual([[true]]);
});

test('a second play ends the first unfinished and cancels its animations', async () => {
  const { el, driver } = mount();
  const first = mock((_finished: boolean) => {});
  const second = mock((_finished: boolean) => {});
  driver.play(compiled(fade()), 1, { onEnd: first });
  driver.play(compiled(slide()), -1, { onEnd: second });

  expect(first.mock.calls).toEqual([[false]]);
  expect(waapi.animations[0]!.calls).toEqual(['cancel']);
  expect(waapi.animations[1]!.calls).toEqual(['cancel']);
  expect(waapi.liveOn(el)).toHaveLength(2);

  for (const animation of waapi.liveOn(el)) animation.finish();
  await settle();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second.mock.calls).toEqual([[true]]);
});

test('setPressed blends a scale animation in over the press duration, and back out', () => {
  const { el, driver } = mount();
  driver.setPressed(true, compiled(press({ scale: 0.96 })));

  expect(waapi.animations).toHaveLength(1);
  const pressed = waapi.animations[0]!;
  expect(pressed.target).toBe(el);
  expect(pressed.options.fill).toBe('both');
  expect(pressed.options.easing).toBe('linear');
  expect(pressed.options.composite).toBe('add');
  expect(pressed.options.duration as number).toBeCloseTo(120, 3);
  expect(pressed.keyframes[0]).toEqual({ transform: 'scale(1)' });
  expect(scaleOf(pressed.keyframes[1]!)).toBeCloseTo(0.96, 6);
  expect('filter' in pressed.keyframes[1]!).toBe(false);

  pressed.finish();
  driver.setPressed(false, null);
  expect(pressed.calls).toEqual(['cancel']);
  const released = waapi.animations[1]!;
  expect(scaleOf(released.keyframes[0]!)).toBeCloseTo(0.96, 6);
  expect(released.keyframes[1]).toEqual({ transform: 'scale(1)' });
});

test('a release part-way through the press starts from the blend reached', () => {
  const { driver } = mount();
  driver.setPressed(true, compiled(press({ scale: 0.5, duration: 0.1 })));
  waapi.animations[0]!.currentTime = 50;
  driver.setPressed(false, null);
  expect(waapi.animations[1]!.keyframes).toEqual([
    { transform: 'scale(0.75)' },
    { transform: 'scale(1)' },
  ]);
});

test('a press that fades or darkens multiplies through an added filter', () => {
  const { driver } = mount();
  driver.setPressed(true, compiled(press({ scale: 1, opacity: 0.5, brightness: 0.5 })));
  expect(waapi.animations[0]!.keyframes).toEqual([
    { transform: 'scale(1)', filter: 'opacity(1) brightness(1)' },
    { transform: 'scale(1)', filter: 'opacity(0.5) brightness(0.5)' },
  ]);
});

test('a release with no press pose given does nothing', () => {
  const { driver } = mount();
  driver.setPressed(false, null);
  expect(waapi.animations).toEqual([]);
});

test('dispose cancels every animation without calling onEnd, and stops scrubbing', async () => {
  const { el, driver } = mount();
  const onEnd = mock((_finished: boolean) => {});
  const progress = { value: 0 };
  driver.setPressed(true, compiled(press()));
  driver.play(compiled(fade()), -1, { progress, onEnd });
  driver.dispose();
  driver.dispose();

  expect(waapi.liveOn(el)).toEqual([]);
  await flushFrames(2);
  await settle();
  expect(onEnd).not.toHaveBeenCalled();
});

test('flipReflow plays each moved child from where it was to where it is', () => {
  const container = document.createElement('div');
  const moved = document.createElement('div');
  const still = document.createElement('div');
  const added = document.createElement('div');
  container.append(moved, still, added);
  moved.getBoundingClientRect = () => new DOMRect(0, 40, 100, 40);
  still.getBoundingClientRect = () => new DOMRect(0, 80, 100, 40);
  added.getBoundingClientRect = () => new DOMRect(0, 120, 100, 40);

  const before = new Map<Element, DOMRect>([
    [moved, new DOMRect(10, 100, 100, 40)],
    [still, new DOMRect(0, 80, 100, 40)],
  ]);
  flipReflow(container, before, 0.2);

  expect(waapi.animations).toHaveLength(1);
  const flip = waapi.animations[0]!;
  expect(flip.target).toBe(moved);
  expect(flip.keyframes).toEqual([
    { transform: 'translate(10px, 60px)' },
    { transform: 'translate(0px, 0px)' },
  ]);
  expect(flip.options).toEqual({ duration: 200, easing: 'ease-out', composite: 'add' });
});

test('a second flipReflow replaces the one still running on a child', () => {
  const container = document.createElement('div');
  const child = document.createElement('div');
  container.append(child);
  let measuredWhileRunning = false;
  child.getBoundingClientRect = () => {
    measuredWhileRunning ||= waapi.liveOn(child).length > 0;
    return new DOMRect(0, 0, 100, 40);
  };

  flipReflow(container, new Map([[child, new DOMRect(0, 40, 100, 40)]]), 0.2);
  measuredWhileRunning = false;
  flipReflow(container, new Map([[child, new DOMRect(0, 20, 100, 40)]]), 0.2);

  // The first is cancelled before the child is measured, so its offset is not in the box.
  expect(measuredWhileRunning).toBe(false);
  expect(waapi.animations[0]!.calls).toEqual(['cancel']);
  expect(waapi.liveOn(child)).toHaveLength(1);
  expect(waapi.liveOn(child)[0]!.keyframes[0]).toEqual({ transform: 'translate(0px, 20px)' });
});

const sourceFiles = (dir: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
};

test('nothing in src/web imports react-native, Reanimated or Skia', () => {
  const files = sourceFiles(join(import.meta.dir, '..', '..', 'src', 'web'));
  expect(files.length).toBeGreaterThan(0);
  const offenders = files.filter((file) =>
    /from\s+['"](react-native|react-native-reanimated|react-native-worklets|@shopify\/react-native-skia)['"/]/.test(
      readFileSync(file, 'utf8'),
    ),
  );
  expect(offenders).toEqual([]);
});
