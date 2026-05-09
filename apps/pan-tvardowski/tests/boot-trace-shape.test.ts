import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { GameContextValue } from '@flare-engine/engine';
import {
  getBootTrace,
  markBootMilestone,
  markBootStart,
  resetBootTrace,
} from '../src/perf/cold-start';
import { createBootScene } from '../src/scenes/boot';

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function makeFakeCtx(): GameContextValue {
  return {
    scenes: { go: () => Promise.resolve() },
  } as unknown as GameContextValue;
}

describe('boot trace shape', () => {
  beforeEach(() => {
    resetBootTrace();
    markBootStart();
  });

  afterEach(() => {
    resetBootTrace();
  });

  test('trace has 5 entries after full boot sequence completes', async () => {
    markBootMilestone('providers-mounted');
    markBootMilestone('first-frame');

    const scene = createBootScene(
      makeFakeCtx(),
      async () => {},
      async () => null,
      { current: null },
    )();
    scene.onEnter?.({} as never);
    await flushMicrotasks();
    await flushMicrotasks();

    const trace = getBootTrace();
    expect(trace).toHaveLength(5);
  });

  test('milestone names appear in required order', async () => {
    markBootMilestone('providers-mounted');
    markBootMilestone('first-frame');

    const scene = createBootScene(
      makeFakeCtx(),
      async () => {},
      async () => null,
      { current: null },
    )();
    scene.onEnter?.({} as never);
    await flushMicrotasks();
    await flushMicrotasks();

    const names = getBootTrace().map((e) => e.name);
    expect(names).toEqual([
      'boot-start',
      'providers-mounted',
      'first-frame',
      'save-loaded',
      'audio-ready',
    ]);
  });

  test('save-loaded index is strictly before audio-ready index', async () => {
    markBootMilestone('providers-mounted');
    markBootMilestone('first-frame');

    const scene = createBootScene(
      makeFakeCtx(),
      async () => {},
      async () => null,
      { current: null },
    )();
    scene.onEnter?.({} as never);
    await flushMicrotasks();
    await flushMicrotasks();

    const trace = getBootTrace();
    const saveIdx = trace.findIndex((e) => e.name === 'save-loaded');
    const audioIdx = trace.findIndex((e) => e.name === 'audio-ready');
    expect(saveIdx).toBeGreaterThan(-1);
    expect(audioIdx).toBeGreaterThan(saveIdx);
  });

  test('all milestone t values are non-negative', async () => {
    markBootMilestone('providers-mounted');
    markBootMilestone('first-frame');

    const scene = createBootScene(
      makeFakeCtx(),
      async () => {},
      async () => null,
      { current: null },
    )();
    scene.onEnter?.({} as never);
    await flushMicrotasks();
    await flushMicrotasks();

    for (const entry of getBootTrace()) {
      expect(entry.t).toBeGreaterThanOrEqual(0);
    }
  });

  test('markBootMilestone before markBootStart is a no-op — trace stays empty after reset', () => {
    resetBootTrace();
    // startT is null after resetBootTrace without a new markBootStart
    markBootMilestone('premature');
    expect(getBootTrace()).toHaveLength(0);
  });
});
