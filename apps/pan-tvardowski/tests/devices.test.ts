import { describe, expect, test } from 'bun:test';
import rawDevices from '../scripts/perf/devices.json' with { type: 'json' };

type Platform = 'android' | 'ios';
type Tier = 'mid-gate' | 'headroom' | 'low';

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
const VALID_TIERS: ReadonlySet<string> = new Set(['mid-gate', 'headroom', 'low']);

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

  test('tier is one of mid-gate | headroom | low for every entry', () => {
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

  // Mid-tier gate devices: Galaxy A55 (Samsung Exynos 1480) + Pixel 6 (Tensor G1)
  // provide cross-vendor SoC/GPU coverage. Original plan had Pixel 6a + Galaxy
  // A54 but neither is available on TestingBot — substituted with the closest
  // TestingBot-supported equivalents (verified against testingbot.com/devices).
  test('Galaxy A55 is present and not skipped', () => {
    const a55 = devices.find((d) => d.id === 'galaxy-a55');
    expect(a55).not.toBeUndefined();
    if (a55 === undefined) throw new Error('galaxy-a55 not found');
    expect(a55.skip).toBe(false);
    expect(a55.tier).toBe('mid-gate');
    expect(a55.platform).toBe('android');
  });

  test('Pixel 6 is present and not skipped', () => {
    const pixel6 = devices.find((d) => d.id === 'pixel-6');
    expect(pixel6).not.toBeUndefined();
    if (pixel6 === undefined) throw new Error('pixel-6 not found');
    expect(pixel6.skip).toBe(false);
    expect(pixel6.tier).toBe('mid-gate');
    expect(pixel6.platform).toBe('android');
  });

  test('exactly 3 iOS devices, all skip:true with a #137 skipReason', () => {
    const iosDevices = devices.filter((d) => d.platform === 'ios');
    expect(iosDevices.length).toBe(3);
    for (const d of iosDevices) {
      expect(d.skip).toBe(true);
      expect(typeof d.skipReason).toBe('string');
      expect((d.skipReason as string).includes('#137')).toBe(true);
    }
  });

  test('iPhone SE (2022) is present, skip:true, tier low', () => {
    const se3 = devices.find((d) => d.id === 'iphone-se-3');
    expect(se3).not.toBeUndefined();
    if (se3 === undefined) throw new Error('iphone-se-3 not found');
    expect(se3.skip).toBe(true);
    expect(se3.tier).toBe('low');
    expect(se3.platform).toBe('ios');
    expect(se3.name).toBe('iPhone SE (2022)');
  });

  test('iPhone 15 is present, skip:true, tier mid-gate', () => {
    const iphone15 = devices.find((d) => d.id === 'iphone-15');
    expect(iphone15).not.toBeUndefined();
    if (iphone15 === undefined) throw new Error('iphone-15 not found');
    expect(iphone15.skip).toBe(true);
    expect(iphone15.tier).toBe('mid-gate');
    expect(iphone15.platform).toBe('ios');
  });

  test('iPhone 17 Pro is present, skip:true, tier headroom', () => {
    const iphone17pro = devices.find((d) => d.id === 'iphone-17-pro');
    expect(iphone17pro).not.toBeUndefined();
    if (iphone17pro === undefined) throw new Error('iphone-17-pro not found');
    expect(iphone17pro.skip).toBe(true);
    expect(iphone17pro.tier).toBe('headroom');
    expect(iphone17pro.platform).toBe('ios');
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
