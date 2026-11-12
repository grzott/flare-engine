import { describe, expect, test } from 'bun:test';
import {
  createBloom,
  createChromaticAberration,
  createPostFxController,
  createVignette,
} from '../src/index.js';

function makeController() {
  return createPostFxController({
    effects: [
      createVignette('v', { intensity: 0.4, radius: 0.8 }),
      createBloom('bloom', { threshold: 0.7, intensity: 0.5 }),
      createChromaticAberration('chrom', { amount: 0.01 }),
    ],
  });
}

describe('PostFxController.triggerTimed', () => {
  test('enables the named effect immediately', () => {
    const pfx = makeController();
    const effect = pfx.chain.get('chrom');
    // Disable first so there is a clear before/after.
    pfx.chain.setEnabled('chrom', false);
    expect(effect?.enabled).toBe(false);

    pfx.triggerTimed('chrom', 200);
    expect(effect?.enabled).toBe(true);
  });

  test('keeps the effect enabled while decayMs has not elapsed', () => {
    const pfx = makeController();
    pfx.chain.setEnabled('chrom', false);
    pfx.triggerTimed('chrom', 200);

    pfx.update(0.1); // 100 ms elapsed
    expect(pfx.chain.get('chrom')?.enabled).toBe(true);

    pfx.update(0.05); // 150 ms total
    expect(pfx.chain.get('chrom')?.enabled).toBe(true);
  });

  test('disables and restores uniforms on expiry', () => {
    const pfx = makeController();
    // Set a known uniform state before triggering so the snapshot is distinguishable.
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.02 });
    pfx.chain.setEnabled('chrom', false);

    pfx.triggerTimed('chrom', 200);
    // Change uniforms after triggering — restore should revert to the snapshot.
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.99 });

    pfx.update(0.2); // exactly 200 ms — should expire

    const effect = pfx.chain.get('chrom');
    expect(effect?.enabled).toBe(false);
    if (effect?.uniforms.kind === 'chromatic-aberration') {
      expect(effect.uniforms.amount).toBeCloseTo(0.02, 5);
    } else {
      throw new Error('unexpected kind');
    }
  });

  test('re-trigger before expiry resets the countdown', () => {
    const pfx = makeController();
    pfx.chain.setEnabled('chrom', false);
    pfx.triggerTimed('chrom', 200);

    pfx.update(0.1); // 100 ms — still active

    // Re-trigger: countdown resets to 200 ms from this point.
    pfx.triggerTimed('chrom', 200);

    pfx.update(0.1); // 100 ms since reset — still active
    expect(pfx.chain.get('chrom')?.enabled).toBe(true);

    pfx.update(0.11); // 210 ms since reset — expired
    expect(pfx.chain.get('chrom')?.enabled).toBe(false);
  });
});

function chromAmount(pfx: ReturnType<typeof makeController>): number {
  const effect = pfx.chain.get('chrom');
  if (effect?.uniforms.kind !== 'chromatic-aberration') throw new Error('unexpected kind');
  return effect.uniforms.amount;
}

describe('PostFxController.triggerTimed re-trigger snapshot', () => {
  test('a re-trigger keeps the pre-trigger uniforms, not the mid-trigger ones', () => {
    const pfx = makeController();
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.001 });
    pfx.chain.setEnabled('chrom', false);

    pfx.triggerTimed('chrom', 200);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.05 });
    pfx.update(0.1);
    pfx.triggerTimed('chrom', 200);
    expect(chromAmount(pfx)).toBe(0.05);

    pfx.update(0.25);

    expect(pfx.chain.get('chrom')?.enabled).toBe(false);
    expect(chromAmount(pfx)).toBe(0.001);
  });

  test('several re-triggers in a row still restore the first snapshot', () => {
    const pfx = makeController();
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.001 });

    pfx.triggerTimed('chrom', 100);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.05 });
    pfx.triggerTimed('chrom', 100);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.09 });
    pfx.triggerTimed('chrom', 100);

    pfx.update(0.2);
    expect(chromAmount(pfx)).toBe(0.001);
  });

  test('a re-trigger restarts the countdown at the new duration instead of adding to it', () => {
    const pfx = makeController();
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.001 });
    pfx.chain.setEnabled('chrom', false);

    pfx.triggerTimed('chrom', 200);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.05 });
    pfx.update(0.15); // 50 ms left
    pfx.triggerTimed('chrom', 100); // 100 ms from here, not 150

    pfx.update(0.09);
    expect(pfx.chain.get('chrom')?.enabled).toBe(true);
    expect(chromAmount(pfx)).toBe(0.05);

    pfx.update(0.02);
    expect(pfx.chain.get('chrom')?.enabled).toBe(false);
    expect(chromAmount(pfx)).toBe(0.001);
  });

  test('a trigger after expiry snapshots the then-current uniforms', () => {
    const pfx = makeController();
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.001 });
    pfx.triggerTimed('chrom', 100);
    pfx.update(0.2);

    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.03 });
    pfx.triggerTimed('chrom', 100);
    pfx.chain.setUniforms('chrom', { kind: 'chromatic-aberration', amount: 0.07 });
    pfx.update(0.2);

    expect(chromAmount(pfx)).toBe(0.03);
  });
});
