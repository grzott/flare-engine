import { describe, expect, it } from 'bun:test';
import { fadeTransition, noneTransition, slideTransition } from '../src/transition.js';

describe('noneTransition', () => {
  it('completes immediately on start', () => {
    const t = noneTransition();
    expect(t.duration).toBe(0);
    const state = t.start('out');
    expect(state.done).toBe(true);
    expect(state.progress).toBe(1);
  });

  it('update keeps it done', () => {
    const t = noneTransition();
    const state = t.start('in');
    t.update(state, 0.1);
    expect(state.done).toBe(true);
    expect(state.progress).toBe(1);
  });
});

describe('fadeTransition', () => {
  it('has the specified duration', () => {
    const t = fadeTransition(0.5);
    expect(t.duration).toBe(0.5);
  });

  it('defaults to 0.3s', () => {
    const t = fadeTransition();
    expect(t.duration).toBe(0.3);
  });

  it('starts at progress 0', () => {
    const t = fadeTransition(1);
    const state = t.start('out');
    expect(state.progress).toBe(0);
    expect(state.done).toBe(false);
    expect(state.phase).toBe('out');
  });

  it('advances progress over time', () => {
    const t = fadeTransition(1);
    const state = t.start('out');
    t.update(state, 0.5);
    expect(state.progress).toBeCloseTo(0.5, 5);
    expect(state.done).toBe(false);
  });

  it('completes when progress reaches 1', () => {
    const t = fadeTransition(1);
    const state = t.start('out');
    t.update(state, 1.0);
    expect(state.progress).toBe(1);
    expect(state.done).toBe(true);
  });

  it('clamps progress at 1 when overshooting', () => {
    const t = fadeTransition(0.5);
    const state = t.start('in');
    t.update(state, 1.0);
    expect(state.progress).toBe(1);
    expect(state.done).toBe(true);
  });

  it('does not advance past done', () => {
    const t = fadeTransition(0.5);
    const state = t.start('out');
    t.update(state, 0.5);
    expect(state.done).toBe(true);
    t.update(state, 0.5);
    expect(state.progress).toBe(1);
  });
});

describe('slideTransition', () => {
  it('has the specified duration', () => {
    const t = slideTransition(0.5);
    expect(t.duration).toBe(0.5);
  });

  it('defaults to 0.3s and left direction', () => {
    const t = slideTransition();
    expect(t.duration).toBe(0.3);
    expect(t.direction).toBe('left');
  });

  it('exposes the configured direction', () => {
    expect(slideTransition(0.3, 'up').direction).toBe('up');
    expect(slideTransition(0.3, 'right').direction).toBe('right');
    expect(slideTransition(0.3, 'down').direction).toBe('down');
  });

  it('is discriminable from fade via kind', () => {
    expect(slideTransition().kind).toBe('slide');
  });

  it('advances progress over time', () => {
    const t = slideTransition(1);
    const state = t.start('in');
    t.update(state, 0.25);
    expect(state.progress).toBeCloseTo(0.25, 5);
  });

  it('completes when reaching duration', () => {
    const t = slideTransition(0.5);
    const state = t.start('out');
    t.update(state, 0.5);
    expect(state.done).toBe(true);
    expect(state.progress).toBe(1);
  });
});
