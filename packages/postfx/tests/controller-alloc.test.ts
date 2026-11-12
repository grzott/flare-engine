import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import type { Effect, EffectUniforms } from '../src/effect.js';
import {
  createBloom,
  createChromaticAberration,
  createGrayscaleFlash,
  createPostFxController,
  createVignette,
} from '../src/index.js';

function makeController() {
  return createPostFxController({
    effects: [
      createVignette('v', { intensity: 0.4, radius: 0.8 }),
      createBloom('bloom', { threshold: 0.7, intensity: 0.5 }),
      createChromaticAberration('chrom', { amount: 0.01 }),
      createGrayscaleFlash('flash', { intensity: 0 }),
    ],
    flash: { id: 'flash', decay: 4 },
  });
}

function recordSetUniforms(chain: EffectChain): EffectUniforms[] {
  const seen: EffectUniforms[] = [];
  const original = chain.setUniforms.bind(chain);
  chain.setUniforms = (id: string, uniforms: EffectUniforms): void => {
    seen.push(uniforms);
    original(id, uniforms);
  };
  return seen;
}

function strengthOf(effect: Effect | null): number {
  if (effect?.uniforms.kind === 'chromatic-aberration') return effect.uniforms.amount;
  if (effect?.uniforms.kind === 'bloom') return effect.uniforms.intensity;
  throw new Error('unexpected kind');
}

describe('PostFxController.update flash uniforms', () => {
  test('passes one controller-owned object to setUniforms on every flash frame', () => {
    const pfx = makeController();
    pfx.triggerHitFlash();
    const seen = recordSetUniforms(pfx.chain);

    pfx.update(0.05);
    const first = seen[0];
    if (first?.kind !== 'grayscale-flash') throw new Error('unexpected kind');
    expect(first.intensity).toBeCloseTo(0.8, 6);

    pfx.update(0.05);
    pfx.update(0.05);

    expect(seen.length).toBe(3);
    expect(seen[1]).toBe(first);
    expect(seen[2]).toBe(first);
    expect(first.kind).toBe('grayscale-flash');
    expect(first.intensity).toBeCloseTo(0.4, 6);
    expect(pfx.chain.get('flash')?.uniforms).toBe(first);
  });

  test('a second hit flash reuses the same object and spikes it back to 1', () => {
    const pfx = makeController();
    const seen = recordSetUniforms(pfx.chain);
    pfx.triggerHitFlash();
    pfx.update(0.1);
    pfx.triggerHitFlash();

    expect(seen.length).toBe(3);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
    const flash = pfx.chain.get('flash');
    if (flash?.uniforms.kind !== 'grayscale-flash') throw new Error('unexpected kind');
    expect(flash.uniforms.intensity).toBe(1);
  });

  test("never writes into the consumer's own flash uniforms object", () => {
    const flashEffect = createGrayscaleFlash('flash', { intensity: 0.25 });
    const consumerUniforms = flashEffect.uniforms;
    const pfx = createPostFxController({ effects: [flashEffect], flash: { id: 'flash' } });

    pfx.triggerHitFlash();
    for (let i = 0; i < 10; i++) pfx.update(0.016);

    expect(consumerUniforms).toEqual({ kind: 'grayscale-flash', intensity: 0.25 });
    expect(pfx.chain.get('flash')?.uniforms).not.toBe(consumerUniforms);
  });

  test('two controllers do not share a flash uniforms object', () => {
    const a = makeController();
    const b = makeController();
    a.triggerHitFlash();
    b.triggerHitFlash();
    a.update(0.1);

    const ua = a.chain.get('flash')?.uniforms;
    const ub = b.chain.get('flash')?.uniforms;
    expect(ua).not.toBe(ub);
    if (ua?.kind !== 'grayscale-flash' || ub?.kind !== 'grayscale-flash') {
      throw new Error('unexpected kind');
    }
    expect(ua.intensity).toBeCloseTo(0.6, 6);
    expect(ub.intensity).toBe(1);
  });

  test('a flash bound to a non-flash effect still throws the kind mismatch', () => {
    const pfx = createPostFxController({
      effects: [createVignette('v')],
      flash: { id: 'v' },
    });
    expect(() => pfx.triggerHitFlash()).toThrow(/cannot change kind/);
  });
});

describe('PostFxController.update timed expiry', () => {
  test('two timed effects expiring on the same frame both restore and disable', () => {
    const pfx = makeController();
    pfx.chain.setEnabled('chrom', false);
    pfx.chain.setEnabled('bloom', false);
    pfx.triggerTimed('chrom', 100);
    pfx.triggerTimed('bloom', 150);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.9 });
    pfx.chain.setUniforms('bloom', { kind: 'bloom', threshold: 0.7, intensity: 0.9 });

    pfx.update(0.2);

    expect(pfx.chain.get('chrom')?.enabled).toBe(false);
    expect(pfx.chain.get('bloom')?.enabled).toBe(false);
    expect(strengthOf(pfx.chain.get('chrom'))).toBe(0.01);
    expect(strengthOf(pfx.chain.get('bloom'))).toBe(0.5);
  });

  test('an expiry leaves the other pending timer counting from where it was', () => {
    const pfx = makeController();
    pfx.triggerTimed('chrom', 100);
    pfx.triggerTimed('bloom', 300);
    pfx.chain.setUniforms('bloom', { kind: 'bloom', threshold: 0.7, intensity: 0.9 });

    pfx.update(0.15);
    expect(pfx.chain.get('chrom')?.enabled).toBe(false);
    expect(pfx.chain.get('bloom')?.enabled).toBe(true);
    expect(strengthOf(pfx.chain.get('bloom'))).toBe(0.9);

    pfx.update(0.1);
    expect(pfx.chain.get('bloom')?.enabled).toBe(true);

    pfx.update(0.06);
    expect(pfx.chain.get('bloom')?.enabled).toBe(false);
    expect(strengthOf(pfx.chain.get('bloom'))).toBe(0.5);
  });

  test('ids expired on one frame are not re-applied on a later frame', () => {
    const pfx = makeController();
    pfx.triggerTimed('chrom', 100);
    pfx.triggerTimed('bloom', 300);
    pfx.update(0.15);

    pfx.chain.setEnabled('chrom', true);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.4 });
    pfx.update(0.2);

    expect(pfx.chain.get('bloom')?.enabled).toBe(false);
    expect(pfx.chain.get('chrom')?.enabled).toBe(true);
    expect(strengthOf(pfx.chain.get('chrom'))).toBe(0.4);
  });

  test('update requests no Map iterator while timers are pending or expiring', () => {
    const pfx = makeController();
    pfx.triggerHitFlash();
    pfx.triggerTimed('chrom', 100);
    pfx.triggerTimed('bloom', 100);

    const proto = Map.prototype;
    const entries = proto.entries;
    const keys = proto.keys;
    const values = proto.values;
    const iterator = proto[Symbol.iterator];
    let requests = 0;
    proto.entries = function (this: Map<unknown, unknown>) {
      requests++;
      return entries.call(this);
    };
    proto.keys = function (this: Map<unknown, unknown>) {
      requests++;
      return keys.call(this);
    };
    proto.values = function (this: Map<unknown, unknown>) {
      requests++;
      return values.call(this);
    };
    proto[Symbol.iterator] = function (this: Map<unknown, unknown>) {
      requests++;
      return iterator.call(this);
    };
    try {
      pfx.update(0.05);
      pfx.update(0.1);
    } finally {
      proto.entries = entries;
      proto.keys = keys;
      proto.values = values;
      proto[Symbol.iterator] = iterator;
    }

    expect(requests).toBe(0);
    expect(pfx.chain.get('chrom')?.enabled).toBe(false);
    expect(pfx.chain.get('bloom')?.enabled).toBe(false);
  });
});

describe('EffectChain.get / setEnabled lookup', () => {
  function countFindCalls(run: () => void): number {
    const proto = Array.prototype;
    const find = proto.find;
    let calls = 0;
    proto.find = function (this: unknown[], ...args: Parameters<typeof find>) {
      calls++;
      return find.apply(this, args);
    } as typeof find;
    try {
      run();
    } finally {
      proto.find = find;
    }
    return calls;
  }

  test('get returns the stored effect object, or null when the id is absent', () => {
    const chain = new EffectChain();
    const v = createVignette('v');
    const b = createBloom('b');
    chain.add(v);
    chain.add(b);

    expect(chain.get('v')).toBe(v);
    expect(chain.get('b')).toBe(b);
    expect(chain.get('missing')).toBeNull();
    expect(new EffectChain().get('v')).toBeNull();
  });

  test('get and setEnabled act on the first entry when an id appears twice', () => {
    const chain = new EffectChain();
    const first = createVignette('dup');
    const second = createBloom('dup');
    chain.add(first);
    (chain.all() as Effect[]).push(second);

    expect(chain.get('dup')).toBe(first);
    chain.setEnabled('dup', false);
    expect(first.enabled).toBe(false);
    expect(second.enabled).toBe(true);
  });

  test('setEnabled on an absent id changes nothing', () => {
    const chain = new EffectChain();
    const v = createVignette('v');
    chain.add(v);
    chain.setEnabled('missing', false);
    expect(v.enabled).toBe(true);
    expect(chain.length).toBe(1);
  });

  test('get, setEnabled and setUniforms do not go through Array.prototype.find', () => {
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createChromaticAberration('chrom', { amount: 0.01 }));

    const calls = countFindCalls(() => {
      chain.get('chrom');
      chain.get('missing');
      chain.setEnabled('chrom', false);
      chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.02 });
    });

    expect(calls).toBe(0);
    expect(chain.get('chrom')?.enabled).toBe(false);
  });
});
