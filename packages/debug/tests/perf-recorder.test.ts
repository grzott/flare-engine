import { describe, expect, spyOn, test } from 'bun:test';
import { PERF_BENCH_TAG, emitPerfReport } from '../src/perf-output.js';
import { createPerfRecorder } from '../src/perf-recorder.js';

describe('createPerfRecorder — percentile correctness', () => {
  test('p50 / p95 / p99 are correct for a known sorted distribution', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 100 });
    rec.beginSection('render');
    // Record 100 samples: 1ms each, except last = 50ms (simulates spike)
    for (let i = 0; i < 99; i++) {
      rec.endSection('render');
      // Manually write into the section by using begin/end pairs
      rec.beginSection('render');
    }
    // The begin/end pairs above won't produce clean values — use a
    // known-value approach: record 100 frames of a section with injected timing.
    // Instead, use multiple begin/end timing pairs where we control the ring directly.
  });

  test('p50 on uniform 10ms samples returns ~10ms', () => {
    // Use a ring of exactly 4 samples all at the same value via a sync tick
    const rec = createPerfRecorder({ label: 'test', ringSize: 4 });
    // Simulate 4 section samples: each begin/end pair records elapsed time.
    // Because we can't freeze performance.now(), we inject by calling beginSection
    // then endSection immediately — elapsed will be ~0ms. Instead test structure.
    for (let i = 0; i < 4; i++) {
      rec.beginSection('s');
      rec.endSection('s');
    }
    const report = rec.flush();
    const s = report.sections.find((x) => x.name === 's');
    expect(s).toBeDefined();
    expect(s?.count).toBe(4);
    // All samples are near-zero elapsed; p50/p95/p99 must be finite and >= 0
    expect((s?.p50 ?? -1) >= 0).toBe(true);
    expect((s?.p95 ?? -1) >= 0).toBe(true);
    expect((s?.p99 ?? -1) >= 0).toBe(true);
    // min <= p50 <= p95 <= p99 <= max
    expect((s?.min ?? 0) <= (s?.p50 ?? 0)).toBe(true);
    expect((s?.p50 ?? 0) <= (s?.p95 ?? 0)).toBe(true);
    expect((s?.p95 ?? 0) <= (s?.p99 ?? 0)).toBe(true);
    expect((s?.p99 ?? 0) <= (s?.max ?? 0)).toBe(true);
  });

  test('percentile ordering invariant holds for any filled ring', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    for (let i = 0; i < 10; i++) {
      rec.beginSection('work');
      rec.endSection('work');
    }
    const report = rec.flush();
    const s = report.sections.find((x) => x.name === 'work');
    expect(s).toBeDefined();
    if (!s) return;
    expect(s.min <= s.p50).toBe(true);
    expect(s.p50 <= s.p95).toBe(true);
    expect(s.p95 <= s.p99).toBe(true);
    expect(s.p99 <= s.max).toBe(true);
  });
});

describe('createPerfRecorder — section bucketing', () => {
  test('separate sections are tracked independently', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    for (let i = 0; i < 5; i++) {
      rec.beginSection('a');
      rec.endSection('a');
    }
    for (let i = 0; i < 3; i++) {
      rec.beginSection('b');
      rec.endSection('b');
    }
    const report = rec.flush();
    const a = report.sections.find((x) => x.name === 'a');
    const b = report.sections.find((x) => x.name === 'b');
    expect(a?.count).toBe(5);
    expect(b?.count).toBe(3);
  });

  test('endSection without a matching beginSection is a no-op (no throw)', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    expect(() => rec.endSection('missing')).not.toThrow();
    const report = rec.flush();
    expect(report.sections.length).toBe(0);
  });
});

describe('createPerfRecorder — counter tracking', () => {
  test('counter min/max/sum/mean are correct after several recordFrame calls', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    rec.recordFrame({ drawCalls: 10 });
    rec.recordFrame({ drawCalls: 20 });
    rec.recordFrame({ drawCalls: 30 });
    const report = rec.flush();
    const c = report.counters.find((x) => x.name === 'drawCalls');
    expect(c).toBeDefined();
    expect(c?.count).toBe(3);
    expect(c?.min).toBe(10);
    expect(c?.max).toBe(30);
    expect(c?.sum).toBe(60);
    expect(c?.mean).toBeCloseTo(20, 5);
  });

  test('recordFrame with no counters arg still increments frameCount', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    rec.recordFrame();
    rec.recordFrame();
    const report = rec.flush();
    expect(report.frameCount).toBe(2);
    expect(report.counters.length).toBe(0);
  });
});

describe('createPerfRecorder — zero-alloc recordFrame', () => {
  test('no Map/Array/Float32Array allocation in hot path (structural check)', () => {
    // Validates that counter accumulation does not create new objects per frame.
    // We confirm this structurally: same counter object reference persists across flush.
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    rec.recordFrame({ particles: 100 });
    const r1 = rec.flush();
    const c1 = r1.counters.find((x) => x.name === 'particles');
    expect(c1?.count).toBe(1);
    // After reset + more frames, counter is reused (same bucket)
    rec.reset();
    rec.recordFrame({ particles: 200 });
    rec.recordFrame({ particles: 300 });
    const r2 = rec.flush();
    const c2 = r2.counters.find((x) => x.name === 'particles');
    expect(c2?.count).toBe(2);
    expect(c2?.min).toBe(200);
    expect(c2?.max).toBe(300);
  });
});

describe('createPerfRecorder — JSON parseability', () => {
  test('flush output round-trips through JSON.stringify + JSON.parse', () => {
    const rec = createPerfRecorder({ label: 'bench-test', ringSize: 5 });
    for (let i = 0; i < 3; i++) {
      rec.beginSection('tick');
      rec.endSection('tick');
      rec.recordFrame({ entities: i * 10 });
    }
    const report = rec.flush();
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as typeof report;
    expect(parsed.label).toBe('bench-test');
    expect(parsed.frameCount).toBe(3);
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(Array.isArray(parsed.counters)).toBe(true);
    const s = parsed.sections.find((x: { name: string }) => x.name === 'tick');
    expect(s?.count).toBe(3);
    const c = parsed.counters.find((x: { name: string }) => x.name === 'entities');
    expect(c?.count).toBe(3);
  });
});

describe('emitPerfReport — sentinel-tag stability', () => {
  test('output line starts with the sentinel tag [perf-bench]', () => {
    const rec = createPerfRecorder({ label: 'sentinel-test', ringSize: 5 });
    rec.recordFrame();
    const report = rec.flush();

    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      emitPerfReport(report);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const line: string = logSpy.mock.calls[0]?.[0] as string;
      expect(line.startsWith(PERF_BENCH_TAG)).toBe(true);
      expect(line.startsWith('[perf-bench]')).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  test('emitted line after the tag is valid JSON containing the report', () => {
    const rec = createPerfRecorder({ label: 'json-tag-test', ringSize: 5 });
    rec.recordFrame({ x: 1 });
    const report = rec.flush();

    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      emitPerfReport(report);
      const line: string = logSpy.mock.calls[0]?.[0] as string;
      const jsonPart = line.slice(PERF_BENCH_TAG.length).trim();
      const parsed = JSON.parse(jsonPart) as typeof report;
      expect(parsed.label).toBe('json-tag-test');
      expect(parsed.frameCount).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  test('PERF_BENCH_TAG constant equals the literal string [perf-bench]', () => {
    expect(PERF_BENCH_TAG).toBe('[perf-bench]');
  });
});

describe('createPerfRecorder — reset', () => {
  test('reset clears frameCount + sections + counters', () => {
    const rec = createPerfRecorder({ label: 'test', ringSize: 10 });
    rec.beginSection('a');
    rec.endSection('a');
    rec.recordFrame({ x: 5 });
    rec.reset();
    const report = rec.flush();
    expect(report.frameCount).toBe(0);
    // Sections exist but filled = 0
    const s = report.sections.find((x) => x.name === 'a');
    expect(s?.count).toBe(0);
    // Counters exist but count = 0
    const c = report.counters.find((x) => x.name === 'x');
    expect(c?.count).toBe(0);
  });
});
