import { describe, expect, it } from 'bun:test';
import type { SpriteSheet } from '@flare-engine/assets';
import {
  createSpriteAnimator,
  getCurrentFrame,
  pauseAnimation,
  playAnimation,
  resumeAnimation,
  stopAnimation,
  updateAnimator,
} from '../src/sprite-animator.js';

function makeSheet(): SpriteSheet {
  const frames = [
    { name: 'walk_0', x: 0, y: 0, w: 32, h: 32 },
    { name: 'walk_1', x: 32, y: 0, w: 32, h: 32 },
    { name: 'walk_2', x: 64, y: 0, w: 32, h: 32 },
    { name: 'idle_0', x: 0, y: 32, w: 32, h: 32 },
  ];
  const animations = new Map([
    ['walk', { name: 'walk', frameIndices: [0, 1, 2], frameDuration: 0.1, loop: true }],
    ['die', { name: 'die', frameIndices: [0, 1, 2], frameDuration: 0.1, loop: false }],
  ]);
  return {
    frames,
    frameMap: new Map(frames.map((f, i) => [f.name, i])),
    animations,
  };
}

describe('SpriteAnimator', () => {
  it('starts with no animation', () => {
    const state = createSpriteAnimator(makeSheet());
    expect(state.currentAnimation).toBeNull();
    expect(getCurrentFrame(state)).toBeNull();
  });

  it('plays an animation', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');
    expect(state.currentAnimation).toBe('walk');
    expect(state.frameIndex).toBe(0);
    expect(getCurrentFrame(state)!.name).toBe('walk_0');
  });

  it('advances frames over time', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');

    updateAnimator(state, 0.05); // Halfway through frame 0
    expect(state.frameIndex).toBe(0);

    updateAnimator(state, 0.06); // Past frame 0 duration (0.11 total)
    expect(state.frameIndex).toBe(1);
    expect(getCurrentFrame(state)!.name).toBe('walk_1');
  });

  it('loops back to frame 0', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');

    // Advance through all 3 frames + some
    updateAnimator(state, 0.35); // 0.35 / 0.1 = 3.5 frames → wraps to frame 0.5
    expect(state.frameIndex).toBeLessThan(3);
    expect(state.finished).toBe(false);
  });

  it('non-looping animation finishes on last frame', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'die');

    updateAnimator(state, 0.35); // Past all 3 frames
    expect(state.finished).toBe(true);
    expect(state.frameIndex).toBe(2);
    expect(getCurrentFrame(state)!.name).toBe('walk_2');
  });

  it('does not advance when paused', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');
    pauseAnimation(state);

    updateAnimator(state, 1.0);
    expect(state.frameIndex).toBe(0);
  });

  it('resumes after pause', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');
    pauseAnimation(state);
    resumeAnimation(state);

    updateAnimator(state, 0.15);
    expect(state.frameIndex).toBe(1);
  });

  it('stop clears the animation', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');
    updateAnimator(state, 0.15);
    stopAnimation(state);

    expect(state.currentAnimation).toBeNull();
    expect(state.frameIndex).toBe(0);
    expect(getCurrentFrame(state)).toBeNull();
  });

  it('play resets if called on already playing animation', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');
    updateAnimator(state, 0.15);
    expect(state.frameIndex).toBe(1);

    playAnimation(state, 'walk');
    expect(state.frameIndex).toBe(0);
    expect(state.elapsed).toBe(0);
  });

  it('ignores play of non-existent animation', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'nonexistent');
    expect(state.currentAnimation).toBeNull();
  });

  it('updateAnimator returns current frame', () => {
    const state = createSpriteAnimator(makeSheet());
    playAnimation(state, 'walk');
    const frame = updateAnimator(state, 0.05);
    expect(frame).not.toBeNull();
    expect(frame!.name).toBe('walk_0');
  });

  it('updateAnimator returns null with no animation', () => {
    const state = createSpriteAnimator(makeSheet());
    expect(updateAnimator(state, 0.1)).toBeNull();
  });

  it('throws when frameDuration is 0', () => {
    const frames = [{ name: 'f0', x: 0, y: 0, w: 32, h: 32 }];
    const animations = new Map([
      ['bad', { name: 'bad', frameIndices: [0], frameDuration: 0, loop: true }],
    ]);
    const sheet: SpriteSheet = { frames, frameMap: new Map([['f0', 0]]), animations };
    const state = createSpriteAnimator(sheet);
    playAnimation(state, 'bad');
    expect(() => updateAnimator(state, 0.016)).toThrow('updateAnimator: frameDuration must be > 0');
  });

  it('throws when frameDuration is negative', () => {
    const frames = [{ name: 'f0', x: 0, y: 0, w: 32, h: 32 }];
    const animations = new Map([
      ['bad', { name: 'bad', frameIndices: [0], frameDuration: -1, loop: true }],
    ]);
    const sheet: SpriteSheet = { frames, frameMap: new Map([['f0', 0]]), animations };
    const state = createSpriteAnimator(sheet);
    playAnimation(state, 'bad');
    expect(() => updateAnimator(state, 0.016)).toThrow('updateAnimator: frameDuration must be > 0');
  });
});
