import { describe, expect, it } from 'bun:test';
import { easeInOutSine, linear } from '@flare-engine/math';
import { periodicTween, resetPeriodicTween, updatePeriodicTween } from '../src/periodic.js';

describe('periodicTween', () => {
  it('factory sets correct fields with default easing', () => {
    const tw = periodicTween(0, 10, 2.0);
    expect(tw.from).toBe(0);
    expect(tw.to).toBe(10);
    expect(tw.period).toBe(2.0);
    expect(tw.easing).toBe(easeInOutSine);
    expect(tw.elapsed).toBe(0);
    expect(tw.value).toBe(0);
  });

  it('at t=0 value equals from (exact equality)', () => {
    const tw = periodicTween(5, 15, 1.0);
    // No update — value must be exactly from.
    expect(tw.value).toBe(5);
    // Also verify after a zero-dt update.
    updatePeriodicTween(tw, 0);
    expect(tw.value).toBe(5);
  });

  it('at half-period value equals to', () => {
    const tw = periodicTween(0, 10, 2.0);
    updatePeriodicTween(tw, 1.0); // half of period=2
    // easeInOutSine(1.0) = 1.0, so value should equal to
    expect(tw.value).toBeCloseTo(10, 5);
  });

  it('at full period value returns to from', () => {
    const tw = periodicTween(0, 10, 2.0);
    updatePeriodicTween(tw, 2.0); // full period → elapsed wraps to 0
    expect(tw.value).toBeCloseTo(0, 5);
  });

  it('at 3/4 period value is near midpoint on return trip with sineInOut', () => {
    const tw = periodicTween(0, 10, 2.0);
    updatePeriodicTween(tw, 1.5); // 3/4 of period=2 → in second half, t=0.5
    // easeInOutSine(0.5) = 0.5 exactly → midpoint
    expect(tw.value).toBeCloseTo(5, 1);
  });

  it('explicit linear easing produces linear ramp at quarter-period', () => {
    const twLinear = periodicTween(0, 10, 2.0, linear);
    const twSine = periodicTween(0, 10, 2.0); // sineInOut default
    updatePeriodicTween(twLinear, 0.5); // quarter period → t=0.5 linear → value=5
    updatePeriodicTween(twSine, 0.5); // quarter period → t=0.5 sineInOut → value≠5
    expect(twLinear.value).toBeCloseTo(5, 5);
    // sineInOut at t=0.5 is 0.5 too (it's symmetric), but at t=0.25 they differ.
    // Re-test at t=0.25 to show they differ.
    const twL2 = periodicTween(0, 10, 2.0, linear);
    const twS2 = periodicTween(0, 10, 2.0);
    updatePeriodicTween(twL2, 0.25); // t=0.25 → linear value=2.5
    updatePeriodicTween(twS2, 0.25); // t=0.25 → sineInOut(0.25) ≠ 0.25
    expect(twL2.value).toBeCloseTo(2.5, 5);
    expect(twS2.value).not.toBeCloseTo(2.5, 1);
  });

  it('resetPeriodicTween zeroes elapsed and restores value to from', () => {
    const tw = periodicTween(3, 8, 1.0);
    updatePeriodicTween(tw, 0.6);
    expect(tw.elapsed).not.toBe(0);
    expect(tw.value).not.toBe(3);
    resetPeriodicTween(tw);
    expect(tw.elapsed).toBe(0);
    expect(tw.value).toBe(3);
  });

  it('large dt wraps correctly — advancing 5×period yields same value as advancing 0', () => {
    const tw1 = periodicTween(0, 10, 2.0);
    const tw2 = periodicTween(0, 10, 2.0);
    // Advance by exactly 5 periods — should wrap to elapsed=0 → value=from.
    updatePeriodicTween(tw1, 10.0);
    updatePeriodicTween(tw2, 0);
    expect(tw1.value).toBeCloseTo(tw2.value, 5);
  });

  it('period <= 0 throws at factory', () => {
    expect(() => periodicTween(0, 1, 0)).toThrow('periodicTween: period must be > 0');
    expect(() => periodicTween(0, 1, -0.5)).toThrow('periodicTween: period must be > 0');
  });
});
