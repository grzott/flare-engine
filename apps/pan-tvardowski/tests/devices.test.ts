import { describe, expect, test } from 'bun:test';
import rawDevices from '../../../scripts/perf/devices.json' with { type: 'json' };

type Platform = 'android' | 'ios';
type Tier = 'mid-gate' | 'headroom';

interface DeviceEntry {
  id: string;
  name: string;
  platform: Platform;
  osVersion: string;
  tier: Tier;
  local: boolean;
  skip: boolean;
  skipReason?: string;
}

const VALID_PLATFORMS: ReadonlySet<string> = new Set(['android', 'ios']);
const VALID_TIERS: ReadonlySet<string> = new Set(['mid-gate', 'headroom']);

const devices = rawDevices as DeviceEntry[];

describe('scripts/perf/devices.json', () => {
  test('parses as a non-empty array', () => {
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
  });

  test('every entry has required fields: id, name, platform, osVersion, tier, local, skip', () => {
    for (const d of devices) {
      expect(typeof d.id).toBe('string');
      expect(d.id.length).toBeGreaterThan(0);
      expect(typeof d.name).toBe('string');
      expect(d.name.length).toBeGreaterThan(0);
      expect(typeof d.platform).toBe('string');
      expect(typeof d.osVersion).toBe('string');
      expect(typeof d.tier).toBe('string');
      expect(typeof d.local).toBe('boolean');
      expect(typeof d.skip).toBe('boolean');
    }
  });

  test('platform is one of android | ios for every entry', () => {
    for (const d of devices) {
      expect(VALID_PLATFORMS.has(d.platform)).toBe(true);
    }
  });

  test('tier is one of mid-gate | headroom for every entry', () => {
    for (const d of devices) {
      expect(VALID_TIERS.has(d.tier)).toBe(true);
    }
  });

  test('skip:true entries must have a non-empty skipReason', () => {
    for (const d of devices) {
      if (d.skip) {
        expect(typeof d.skipReason).toBe('string');
        const reason = d.skipReason as string;
        expect(reason.length).toBeGreaterThan(0);
      }
    }
  });

  test('skip:false entries must not have skipReason', () => {
    for (const d of devices) {
      if (!d.skip) {
        expect(d.skipReason).toBeUndefined();
      }
    }
  });

  test('mid-gate tier is non-empty (at least one non-skipped mid-gate device)', () => {
    const midGateActive = devices.filter((d) => d.tier === 'mid-gate' && !d.skip);
    expect(midGateActive.length).toBeGreaterThan(0);
  });

  test('Pixel 6a is present and not skipped', () => {
    const pixel6a = devices.find((d) => d.id === 'pixel-6a');
    expect(pixel6a).not.toBeUndefined();
    if (pixel6a === undefined) throw new Error('pixel-6a not found');
    expect(pixel6a.skip).toBe(false);
    expect(pixel6a.tier).toBe('mid-gate');
    expect(pixel6a.platform).toBe('android');
  });

  test('Galaxy A54 is present and not skipped', () => {
    const a54 = devices.find((d) => d.id === 'galaxy-a54');
    expect(a54).not.toBeUndefined();
    if (a54 === undefined) throw new Error('galaxy-a54 not found');
    expect(a54.skip).toBe(false);
    expect(a54.tier).toBe('mid-gate');
    expect(a54.platform).toBe('android');
  });

  test('all iOS entries are skip:true', () => {
    const iosDevices = devices.filter((d) => d.platform === 'ios');
    expect(iosDevices.length).toBeGreaterThan(0);
    for (const d of iosDevices) {
      expect(d.skip).toBe(true);
    }
  });

  test('local-avd is present, local:true, and not skipped', () => {
    const avd = devices.find((d) => d.id === 'local-avd');
    expect(avd).not.toBeUndefined();
    if (avd === undefined) throw new Error('local-avd not found');
    expect(avd.local).toBe(true);
    expect(avd.skip).toBe(false);
  });

  test('no duplicate ids', () => {
    const ids = devices.map((d) => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
