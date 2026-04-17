import { describe, expect, test } from 'bun:test';
import { createCrashPayload } from '../src/crash-payload.js';

describe('createCrashPayload', () => {
  test('captures Error instance with message, name, and stack', () => {
    const err = new TypeError('boom');
    const p = createCrashPayload(err);
    expect(p.message).toBe('boom');
    expect(p.name).toBe('TypeError');
    expect(p.stack).toBeTruthy();
    expect(typeof p.timestamp).toBe('number');
  });

  test('captures string throw as Error-shaped payload', () => {
    const p = createCrashPayload('ouch');
    expect(p.message).toBe('ouch');
    expect(p.name).toBe('Error');
    expect(p.stack).toBeNull();
  });

  test('captures arbitrary non-error values via JSON.stringify', () => {
    const p = createCrashPayload({ code: 42 });
    expect(p.message).toBe('{"code":42}');
    expect(p.name).toBe('NonError');
  });

  test('falls back to String() when JSON.stringify throws', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const p = createCrashPayload(circular);
    expect(p.name).toBe('NonError');
    expect(typeof p.message).toBe('string');
  });

  test('merges caller context', () => {
    const p = createCrashPayload(new Error('x'), { userId: 'abc', scene: 'menu' });
    expect(p.context).toEqual({ userId: 'abc', scene: 'menu' });
  });

  test('context defaults to empty object', () => {
    const p = createCrashPayload(new Error('x'));
    expect(p.context).toEqual({});
  });

  test('payload is JSON-serializable', () => {
    const p = createCrashPayload(new Error('x'), { a: 1 });
    const roundtrip = JSON.parse(JSON.stringify(p));
    expect(roundtrip.message).toBe('x');
    expect(roundtrip.context).toEqual({ a: 1 });
  });
});
