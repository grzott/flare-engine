import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { judgeOrder, ORDER_TOLERANCE_PERCENT } from '../src/order-probe.js';
import { srcDir } from '../src/results.js';

/**
 * The probe's timing verdict is not asserted here: a shared CI runner cannot
 * hold a 15% band, so `bun run bench:order` is run by hand on a quiet machine.
 * What is asserted is the judgement over given numbers, and that the child
 * process the probe spawns still runs against the current engine.
 */
describe('bench-order probe', () => {
  it('passes when every after-render reading is inside the band around the alone median', () => {
    const verdict = judgeOrder([60, 61, 62], [64, 58, 70]);
    expect(verdict.aloneMedianNs).toBe(61);
    expect(verdict.rows.map((r) => r.within)).toEqual([true, true, true]);
    expect(verdict.ok).toBe(true);
  });

  it('fails on a single slow reading, and says which', () => {
    const verdict = judgeOrder([60, 60, 60, 60], [61, 130, 62]);
    expect(verdict.ok).toBe(false);
    expect(verdict.rows.map((r) => r.within)).toEqual([true, false, true]);
    expect(verdict.rows[1]?.deltaPercent).toBeCloseTo(116.67, 1);
  });

  it('holds a faster reading to the same band: either way the row depends on bench order', () => {
    const verdict = judgeOrder([100], [100 - ORDER_TOLERANCE_PERCENT - 1]);
    expect(verdict.ok).toBe(false);
    expect(verdict.rows[0]?.deltaPercent).toBeLessThan(0);
  });

  it('takes the band edge as inside', () => {
    expect(judgeOrder([100], [115, 85]).ok).toBe(true);
    expect(judgeOrder([100], [100], 0).ok).toBe(true);
  });

  it('refuses to pass a probe that measured nothing', () => {
    expect(judgeOrder([], [60]).ok).toBe(false);
    expect(judgeOrder([60], []).ok).toBe(false);
  });

  it('the child form runs in a real subprocess and prints one reading', () => {
    const proc = Bun.spawnSync(
      ['bun', 'run', resolve(srcDir(), 'order-probe.ts'), '--mode', 'alone'],
      { cwd: resolve(srcDir(), '..'), stdout: 'pipe', stderr: 'pipe' },
    );
    expect(proc.exitCode).toBe(0);
    const line = proc.stdout.toString().trim().split('\n').pop() ?? '';
    expect(Number(line)).toBeGreaterThan(0);
  }, 30_000);

  it('the child form rejects a mode it does not know', () => {
    const proc = Bun.spawnSync(
      ['bun', 'run', resolve(srcDir(), 'order-probe.ts'), '--mode', 'sideways'],
      { cwd: resolve(srcDir(), '..'), stdout: 'pipe', stderr: 'pipe' },
    );
    expect(proc.exitCode).toBe(2);
  }, 30_000);
});
