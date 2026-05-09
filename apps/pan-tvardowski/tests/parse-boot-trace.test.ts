import { describe, expect, test } from 'bun:test';
import {
  median,
  parseBootTraceLine,
  parseBootTraceLines,
  summarizeDevice,
} from '../scripts/parse-boot-trace';

describe('parseBootTraceLine', () => {
  test('parses a real [boot-trace] line into label + total + deltas', () => {
    const line =
      '[boot-trace] total=2480.5ms boot-start->providers-mounted=312.4ms providers-mounted->save-loaded=48.7ms save-loaded->audio-ready=210.9ms audio-ready->first-frame=1908.5ms';
    const result = parseBootTraceLine(line);
    expect(result).not.toBeNull();
    expect(result?.label).toBe('boot-trace');
    expect(result?.totalMs).toBeCloseTo(2480.5);
    expect(result?.deltas['boot-start->providers-mounted']).toBeCloseTo(312.4);
    expect(result?.deltas['audio-ready->first-frame']).toBeCloseTo(1908.5);
    expect(Object.keys(result?.deltas ?? {})).toHaveLength(4);
  });

  test('returns null for malformed input', () => {
    expect(parseBootTraceLine('')).toBeNull();
    expect(parseBootTraceLine('not a boot trace line')).toBeNull();
    expect(parseBootTraceLine('[boot-trace] no-total-here')).toBeNull();
    expect(parseBootTraceLine('[boot-trace] total=NaNms')).toBeNull();
  });

  test('label override (cold-start-pixel7) is preserved', () => {
    const line = '[cold-start-pixel7] total=1980.2ms boot-start->first-frame=1980.2ms';
    const result = parseBootTraceLine(line);
    expect(result?.label).toBe('cold-start-pixel7');
    expect(result?.totalMs).toBeCloseTo(1980.2);
  });
});

describe('parseBootTraceLines', () => {
  test('extracts multiple lines and skips noise lines', () => {
    const input = [
      '01-01 12:00:00.000  ReactNativeJS: Some unrelated log',
      '01-01 12:00:01.234  ReactNativeJS: [boot-trace] total=2400.0ms boot-start->first-frame=2400.0ms',
      'noise',
      '01-01 12:00:05.678  ReactNativeJS: [boot-trace] total=2390.0ms boot-start->first-frame=2390.0ms',
      '01-01 12:00:09.000  ReactNativeJS: [boot-trace] total=2410.0ms boot-start->first-frame=2410.0ms',
    ].join('\n');
    const results = parseBootTraceLines(input);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.totalMs)).toEqual([2400.0, 2390.0, 2410.0]);
  });

  test('strips logcat timestamp + tag prefix', () => {
    const input =
      '01-15 09:42:11.123  9876  9876 I ReactNativeJS: [boot-trace] total=2520.7ms boot-start->providers-mounted=300.0ms providers-mounted->first-frame=2220.7ms';
    const results = parseBootTraceLines(input);
    expect(results).toHaveLength(1);
    expect(results[0]?.totalMs).toBeCloseTo(2520.7);
    expect(results[0]?.deltas['providers-mounted->first-frame']).toBeCloseTo(2220.7);
  });
});

describe('median + summarizeDevice', () => {
  test('median odd-length picks middle', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([3000, 2400, 2500])).toBe(2500);
  });

  test('median even-length averages two middles', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  test('summarizeDevice flags pass when median < threshold', () => {
    const runs = [
      { label: 'boot-trace', totalMs: 2400, deltas: {} },
      { label: 'boot-trace', totalMs: 2500, deltas: {} },
      { label: 'boot-trace', totalMs: 2450, deltas: {} },
    ];
    const summary = summarizeDevice('Galaxy A55', runs);
    expect(summary.medianTotalMs).toBe(2450);
    expect(summary.passed).toBe(true);
    expect(summary.threshold).toBe(3000);
  });

  test('summarizeDevice flags fail when median >= threshold', () => {
    const runs = [
      { label: 'boot-trace', totalMs: 3100, deltas: {} },
      { label: 'boot-trace', totalMs: 3200, deltas: {} },
      { label: 'boot-trace', totalMs: 3050, deltas: {} },
    ];
    const summary = summarizeDevice('Galaxy A12', runs);
    expect(summary.medianTotalMs).toBe(3100);
    expect(summary.passed).toBe(false);
  });

  test('summarizeDevice with empty runs reports NaN median + fail', () => {
    const summary = summarizeDevice('Pixel 10', []);
    expect(Number.isNaN(summary.medianTotalMs)).toBe(true);
    expect(summary.passed).toBe(false);
  });
});
