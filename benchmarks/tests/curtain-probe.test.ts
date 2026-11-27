import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { parseCurtainProbeOutput } from '../src/curtain-probe.js';
import { measureLoad } from '../src/load.js';
import { PHYSICS_CURTAIN_SCENARIOS } from '../src/scenarios/index.js';

const NAMES = PHYSICS_CURTAIN_SCENARIOS.map((s) => s.name);

const row = (name: string, median = 70_000) => ({
  name,
  innerIters: 8,
  samples: 100,
  nsPerOp: { min: median, median, mean: median, max: median },
  opsPerSec: 1e9 / median,
  sampleWindowMs: 0.56,
  warmupBatches: 600,
});

const output = (results: unknown, cpuMs: unknown = 4200): string =>
  JSON.stringify({ results, cpuMs });

describe('parseCurtainProbeOutput', () => {
  test('reads the last stdout line, after anything the child printed before it', () => {
    const parsed = parseCurtainProbeOutput(`progress line\n${output(NAMES.map((n) => row(n)))}\n`);
    if (typeof parsed === 'string') throw new Error(parsed);
    expect(parsed.results.map((r) => r.name)).toEqual(NAMES);
    expect(parsed.results[1]?.nsPerOp.median).toBe(70_000);
    expect(parsed.cpuMs).toBe(4200);
  });

  test.each([
    ['unparseable output', 'Segmentation fault', 'unparseable'],
    ['a missing row', output(NAMES.slice(0, 2).map((n) => row(n))), 'expected 3'],
    ['rows out of order', output([...NAMES].reverse().map((n) => row(n))), 'row 0 is'],
    ['a zero median', output(NAMES.map((n, i) => row(n, i === 1 ? 0 : 70_000))), 'no positive'],
    [
      'a NaN cpuMs, which JSON writes as null',
      output(
        NAMES.map((n) => row(n)),
        Number.NaN,
      ),
      'cpuMs',
    ],
    [
      'a negative cpuMs',
      output(
        NAMES.map((n) => row(n)),
        -1,
      ),
      'cpuMs',
    ],
  ])('refuses %s', (_label, stdout, message) => {
    const parsed = parseCurtainProbeOutput(stdout);
    expect(typeof parsed).toBe('string');
    expect(parsed as string).toContain(message);
  });

  test('the CLI measures every curtain row in its own process and reports its CPU', () => {
    const probe = resolve(import.meta.dir, '../src/curtain-probe.ts');
    const proc = Bun.spawnSync([process.execPath, 'run', probe, '--smoke'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(proc.exitCode).toBe(0);
    const parsed = parseCurtainProbeOutput(proc.stdout.toString());
    if (typeof parsed === 'string') throw new Error(parsed);
    expect(parsed.results.map((r) => r.name)).toEqual(NAMES);
    expect(parsed.cpuMs).toBeGreaterThan(0);
  }, 60_000);
});

describe('measureLoad', () => {
  // 16 cores over a 1 s window: 16000 ms of capacity, 2000 ms busy, 500 ms of it in-process.
  const before = { busyMs: 0, totalMs: 0, ownMs: 0 };
  const after = { busyMs: 2000, totalMs: 16_000, ownMs: 500 };

  test('counts a child the capture spawned as its own CPU, not a neighbour', () => {
    expect(measureLoad(before, after).foreignPercent).toBeCloseTo(9.375);
    const credited = measureLoad(before, after, 1000);
    expect(credited.foreignPercent).toBeCloseTo(3.125);
    expect(credited.ownPercent).toBeCloseTo(9.375);
  });

  test('never reports negative foreign load when the child reports more than the machine was busy', () => {
    const credited = measureLoad(before, after, 5000);
    expect(credited.foreignPercent).toBe(0);
    expect(credited.ownPercent).toBeCloseTo(12.5);
  });
});
