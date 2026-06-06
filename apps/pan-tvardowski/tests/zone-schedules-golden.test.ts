import { describe, expect, test } from 'bun:test';
import {
  buildZone1Schedule,
  buildZone2Schedule,
  buildZone3Schedule,
  buildZone4Schedule,
  buildZone5Schedule,
  buildZone6Schedule,
  buildZone7Schedule,
  buildZone8Schedule,
} from '../src/systems/spawner';
import {
  GOLDEN_ZONE1_SEED_0x1234,
  GOLDEN_ZONE2_SEED_0x1234,
  GOLDEN_ZONE3_SEED_0xC0FFEE,
  GOLDEN_ZONE4_SEED_0xDEADBEEF,
  GOLDEN_ZONE5_SEED_0xDEADBEEF,
  GOLDEN_ZONE6_SEED_0xCAFEBABE,
  GOLDEN_ZONE7_SEED_0xDEADBEEF,
  GOLDEN_ZONE8_SEED_0xC0FFEE,
} from './snapshots/zone-schedules.snap';

describe('zone-schedules golden', () => {
  test('zone 1 seed 0x1234 is byte-identical', () => {
    expect(buildZone1Schedule(0x1234, 360)).toEqual(GOLDEN_ZONE1_SEED_0x1234);
  });

  test('zone 2 seed 0x1234 is byte-identical', () => {
    expect(buildZone2Schedule(0x1234, 360)).toEqual(GOLDEN_ZONE2_SEED_0x1234);
  });

  test('zone 3 seed 0xc0ffee is byte-identical', () => {
    expect(buildZone3Schedule(0xc0ffee, 360)).toEqual(GOLDEN_ZONE3_SEED_0xC0FFEE);
  });

  test('zone 4 seed 0xdeadbeef is byte-identical', () => {
    expect(buildZone4Schedule(0xdeadbeef, 360)).toEqual(GOLDEN_ZONE4_SEED_0xDEADBEEF);
  });

  test('zone 5 seed 0xdeadbeef is byte-identical', () => {
    expect(buildZone5Schedule(0xdeadbeef, 360)).toEqual(GOLDEN_ZONE5_SEED_0xDEADBEEF);
  });

  test('zone 6 seed 0xcafebabe is byte-identical', () => {
    expect(buildZone6Schedule(0xcafebabe, 360)).toEqual(GOLDEN_ZONE6_SEED_0xCAFEBABE);
  });

  test('zone 7 seed 0xdeadbeef is byte-identical', () => {
    expect(buildZone7Schedule(0xdeadbeef, 360)).toEqual(GOLDEN_ZONE7_SEED_0xDEADBEEF);
  });

  test('zone 8 seed 0xc0ffee is byte-identical', () => {
    expect(buildZone8Schedule(0xc0ffee, 360)).toEqual(GOLDEN_ZONE8_SEED_0xC0FFEE);
  });
});
