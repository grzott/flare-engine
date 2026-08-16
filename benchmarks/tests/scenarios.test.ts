import { describe, expect, it } from 'bun:test';
import { EXPECTED_SCENARIOS, EXPECTED_SUITE_TITLES } from '../src/scenario-contract.js';
import { SCENARIOS } from '../src/scenarios/index.js';

describe('scenario SoT', () => {
  it('covers every suite the contract freezes', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual([...EXPECTED_SUITE_TITLES].sort());
  });

  it('produces exactly the frozen scenario names, in order', () => {
    for (const title of EXPECTED_SUITE_TITLES) {
      const names = SCENARIOS[title]!.map((s) => s.name);
      expect(names).toEqual([...EXPECTED_SCENARIOS[title]!]);
    }
  });

  it('descriptors carry no runtime handles', () => {
    for (const title of EXPECTED_SUITE_TITLES) {
      for (const s of SCENARIOS[title]!) {
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }
    }
  });
});
