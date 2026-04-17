import { describe, expect, it } from 'bun:test';
import {
  createButtonState,
  pressButton,
  releaseButton,
  resetButtonFrame,
} from '../src/virtual-button.js';

describe('VirtualButton', () => {
  it('creates with default state', () => {
    const state = createButtonState();
    expect(state.isPressed).toBe(false);
    expect(state.justPressed).toBe(false);
    expect(state.justReleased).toBe(false);
  });

  it('sets justPressed on press', () => {
    const state = createButtonState();
    pressButton(state);
    expect(state.isPressed).toBe(true);
    expect(state.justPressed).toBe(true);
    expect(state.justReleased).toBe(false);
  });

  it('clears justPressed on frame reset', () => {
    const state = createButtonState();
    pressButton(state);
    resetButtonFrame(state);
    expect(state.isPressed).toBe(true);
    expect(state.justPressed).toBe(false);
  });

  it('sets justReleased on release', () => {
    const state = createButtonState();
    pressButton(state);
    resetButtonFrame(state);
    releaseButton(state);
    expect(state.isPressed).toBe(false);
    expect(state.justReleased).toBe(true);
  });

  it('clears justReleased on frame reset', () => {
    const state = createButtonState();
    pressButton(state);
    resetButtonFrame(state);
    releaseButton(state);
    resetButtonFrame(state);
    expect(state.justReleased).toBe(false);
  });

  it('ignores duplicate press', () => {
    const state = createButtonState();
    pressButton(state);
    resetButtonFrame(state);
    pressButton(state); // Already pressed
    expect(state.justPressed).toBe(false); // Should not re-trigger
  });

  it('ignores release when not pressed', () => {
    const state = createButtonState();
    releaseButton(state);
    expect(state.justReleased).toBe(false);
  });
});
