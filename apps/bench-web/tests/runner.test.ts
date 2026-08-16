import { describe, expect, it } from 'bun:test';
import { EXPECTED_SCENARIOS } from '@flare-engine/benchmarks/scenario-contract';
import { RENDER_SCENARIO_NAMES } from '../src/runner.js';

describe('bench-web runner scenario coverage', () => {
  it('covers every Render-suite scenario the contract freezes, in order', () => {
    expect(RENDER_SCENARIO_NAMES).toEqual([...EXPECTED_SCENARIOS.Render!]);
  });

  it('has no duplicate scenario names', () => {
    expect(new Set(RENDER_SCENARIO_NAMES).size).toBe(RENDER_SCENARIO_NAMES.length);
  });
});
