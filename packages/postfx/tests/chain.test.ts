import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { createBloom, createVignette } from '../src/effect.js';

describe('EffectChain', () => {
  test('add / remove / get', () => {
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    expect(chain.length).toBe(1);
    expect(chain.get('v')?.id).toBe('v');
    expect(chain.remove('v')).toBe(true);
    expect(chain.remove('v')).toBe(false);
    expect(chain.length).toBe(0);
  });

  test('add rejects duplicate id', () => {
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    expect(() => chain.add(createVignette('v'))).toThrow();
  });

  test('insert clamps the index', () => {
    const chain = new EffectChain();
    chain.add(createVignette('a'));
    chain.add(createBloom('b'));
    chain.insert(-5, createBloom('c'));
    chain.insert(999, createBloom('d'));
    expect(chain.all().map((e) => e.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  test('setEnabled toggles a named effect', () => {
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.setEnabled('v', false);
    expect(chain.get('v')?.enabled).toBe(false);
    expect(Array.from(chain.enabled())).toEqual([]);
  });

  test('setUniforms updates values but rejects kind mismatch', () => {
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.setUniforms('v', { kind: 'vignette', intensity: 0.9, radius: 0.5 });
    const e = chain.get('v');
    if (e && e.uniforms.kind === 'vignette') {
      expect(e.uniforms.intensity).toBe(0.9);
      expect(e.uniforms.radius).toBe(0.5);
    }
    expect(() => chain.setUniforms('v', { kind: 'bloom', threshold: 0.5, intensity: 1 })).toThrow();
  });

  test('move reorders effects', () => {
    const chain = new EffectChain();
    chain.add(createVignette('a'));
    chain.add(createBloom('b'));
    chain.add(createBloom('c'));
    chain.move('a', 2);
    expect(chain.all().map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  test('enabled() iterator skips disabled entries in order', () => {
    const chain = new EffectChain();
    chain.add(createVignette('a'));
    chain.add(createBloom('b'));
    chain.add(createBloom('c'));
    chain.setEnabled('b', false);
    expect(Array.from(chain.enabled()).map((e) => e.id)).toEqual(['a', 'c']);
  });

  test('clear removes everything', () => {
    const chain = new EffectChain();
    chain.add(createVignette('a'));
    chain.clear();
    expect(chain.length).toBe(0);
  });

  test('globalIntensity defaults to 1', () => {
    const chain = new EffectChain();
    expect(chain.globalIntensity).toBe(1);
  });

  test('globalIntensity clamps negatives to 0', () => {
    const chain = new EffectChain();
    chain.globalIntensity = -0.5;
    expect(chain.globalIntensity).toBe(0);
    chain.setGlobalIntensity(-10);
    expect(chain.globalIntensity).toBe(0);
  });

  test('setGlobalIntensity accepts values above 1', () => {
    const chain = new EffectChain();
    chain.setGlobalIntensity(1.5);
    expect(chain.globalIntensity).toBe(1.5);
  });
});
