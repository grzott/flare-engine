import { afterEach, describe, expect, it } from 'bun:test';
import { SeededRNG } from '@flare-engine/math';
import { createBenchSession } from '../src/bench-session.js';

let session: ReturnType<typeof createBenchSession> | null = null;

afterEach(() => {
  session?.end();
  session = null;
});

describe('createBenchSession', () => {
  it('Math.random matches SeededRNG(seed).next() sequence', () => {
    const seed = 42;
    session = createBenchSession({ seed });
    const ref = new SeededRNG(seed);
    for (let i = 0; i < 10; i++) {
      expect(Math.random()).toBe(ref.next());
    }
  });

  it('Math.random is restored after end()', () => {
    const original = Math.random;
    session = createBenchSession({ seed: 1 });
    expect(Math.random).not.toBe(original);
    session.end();
    expect(Math.random).toBe(original);
  });

  it('end() is idempotent — second call does not throw', () => {
    session = createBenchSession({ seed: 1 });
    session.end();
    expect(() => session!.end()).not.toThrow();
  });

  it('getFlag returns false when unset', () => {
    session = createBenchSession({ seed: 1 });
    expect(session.getFlag('anything')).toBe(false);
  });

  it('setFlag / getFlag round-trip', () => {
    session = createBenchSession({ seed: 1 });
    session.setFlag('ready', true);
    expect(session.getFlag('ready')).toBe(true);
    session.setFlag('ready', false);
    expect(session.getFlag('ready')).toBe(false);
  });

  it('whenDone resolves after done() is called', async () => {
    session = createBenchSession({ seed: 1 });
    let resolved = false;
    const p = session.whenDone.then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    session.done();
    await p;
    expect(resolved).toBe(true);
  });

  it('done() is idempotent — calling twice does not reject', async () => {
    session = createBenchSession({ seed: 1 });
    session.done();
    await expect(
      new Promise<void>((res) => {
        session!.done();
        res();
      }),
    ).resolves.toBeUndefined();
  });

  it('same seed produces the same sequence', () => {
    const s1 = createBenchSession({ seed: 7 });
    const vals1 = [Math.random(), Math.random(), Math.random()];
    s1.end();

    const s2 = createBenchSession({ seed: 7 });
    const vals2 = [Math.random(), Math.random(), Math.random()];
    s2.end();

    expect(vals1).toEqual(vals2);
    session = null;
  });

  it('default seed (1) reproduces the exact SeededRNG(1) sequence (known-answer)', () => {
    session = createBenchSession();
    const ref = new SeededRNG(1);
    for (let i = 0; i < 5; i++) {
      expect(Math.random()).toBe(ref.next());
    }
  });
});
