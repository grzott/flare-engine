import { describe, expect, test } from 'bun:test';
import { Clock } from '@flare-engine/core';
import { TimeControl } from '../src/time-control.js';

describe('TimeControl', () => {
  test('starts unpaused', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    expect(tc.paused).toBe(false);
    expect(tc.timescale).toBe(1);
  });

  test('pause sets timescale to 0', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    tc.pause();
    expect(tc.paused).toBe(true);
    expect(clock.timescale).toBe(0);
  });

  test('resume restores previous timescale', () => {
    const clock = new Clock();
    clock.timescale = 0.5;
    const tc = new TimeControl(clock);
    tc.pause();
    expect(clock.timescale).toBe(0);
    tc.resume();
    expect(tc.paused).toBe(false);
    expect(clock.timescale).toBe(0.5);
  });

  test('pause is idempotent', () => {
    const clock = new Clock();
    clock.timescale = 2;
    const tc = new TimeControl(clock);
    tc.pause();
    clock.timescale = 0; // Already 0, but calling pause again shouldn't save 0
    tc.pause();
    tc.resume();
    expect(clock.timescale).toBe(2);
  });

  test('resume when not paused is no-op', () => {
    const clock = new Clock();
    clock.timescale = 1.5;
    const tc = new TimeControl(clock);
    tc.resume();
    expect(clock.timescale).toBe(1.5);
  });

  test('toggle pauses and unpauses', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    tc.toggle();
    expect(tc.paused).toBe(true);
    tc.toggle();
    expect(tc.paused).toBe(false);
    expect(clock.timescale).toBe(1);
  });

  test('step does nothing when not paused', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    tc.step();
    expect(tc.consumeStep()).toBe(false);
  });

  test('step while paused sets pending step', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    tc.pause();
    tc.step();
    expect(tc.consumeStep()).toBe(true);
    // Second consume returns false
    expect(tc.consumeStep()).toBe(false);
  });

  test('setTimescale updates clock when unpaused', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    tc.setTimescale(0.25);
    expect(clock.timescale).toBe(0.25);
  });

  test('setTimescale updates saved value when paused', () => {
    const clock = new Clock();
    const tc = new TimeControl(clock);
    tc.pause();
    tc.setTimescale(0.5);
    expect(clock.timescale).toBe(0); // Still paused
    tc.resume();
    expect(clock.timescale).toBe(0.5); // Restored the updated value
  });
});
