import { GameLoop } from '@flare-engine/core';
import { World } from '@flare-engine/ecs';
import { createFakeClock, type FakeClock } from './fake-clock.js';

export interface TestWorld {
  /** ECS world. */
  readonly world: World;
  /** Game loop wired to a fake clock. */
  readonly loop: GameLoop;
  /** Fake clock driving the loop. */
  readonly clock: FakeClock;
  /** Advance one frame of `dt` seconds. Runs the loop's fixed + variable update. */
  step(dt: number): void;
  /** Advance `frames` frames of `dt` seconds each. */
  stepFrames(frames: number, dt?: number): void;
}

export interface CreateTestWorldOptions {
  /** Fixed timestep passed to `GameLoop`. Defaults to 1/60. */
  fixedDt?: number;
  /** Maximum raw dt cap passed to `GameLoop`. Defaults to 0.25s. */
  maxDt?: number;
}

/**
 * Create a World + GameLoop + FakeClock wired together for deterministic
 * testing. `step()` calls the loop's `step()` directly so fixed and variable
 * updates fire for the exact dt you pass, without needing to start the rAF
 * loop.
 */
export function createTestWorld(options: CreateTestWorldOptions = {}): TestWorld {
  const world = new World();
  const loop = new GameLoop(options);
  const clock = createFakeClock();
  loop.tick = clock.requestFrame;
  loop.cancelTick = clock.cancelFrame;

  return {
    world,
    loop,
    clock,
    step(dt) {
      loop.step(dt);
    },
    stepFrames(frames, dt = 1 / 60) {
      for (let i = 0; i < frames; i++) loop.step(dt);
    },
  };
}
