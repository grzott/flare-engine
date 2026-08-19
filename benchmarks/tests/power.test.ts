import { describe, expect, it } from 'bun:test';
import { judgePowerScheme, readPowerScheme } from '../src/power.js';

const POWER_SAVER = 'a1841308-3541-4fab-bc81-f71556f20b4a';
const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const HIGH_PERFORMANCE = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const ULTIMATE = 'e9a42b02-d5df-448d-aa00-03f14749eb61';

describe('judgePowerScheme', () => {
  it('refuses Power saver, the plan measured to distort every scenario', () => {
    const v = judgePowerScheme({ guid: POWER_SAVER, label: 'Power saver' });
    expect(v.kind).toBe('refuse');
    if (v.kind !== 'refuse') return;
    // The message must carry the fix, not just the verdict — this fires on a machine mid-capture.
    expect(v.message).toContain('powercfg /setactive');
    expect(v.message).toContain(HIGH_PERFORMANCE);
  });

  it('accepts High performance and Ultimate', () => {
    expect(judgePowerScheme({ guid: HIGH_PERFORMANCE, label: 'High performance' }).kind).toBe('ok');
    expect(judgePowerScheme({ guid: ULTIMATE, label: 'Ultimate' }).kind).toBe('ok');
  });

  it('warns on Balanced rather than refusing — its effect has never been measured here', () => {
    const v = judgePowerScheme({ guid: BALANCED, label: 'Balanced' });
    expect(v.kind).toBe('warn');
    if (v.kind !== 'warn') return;
    expect(v.message).toContain('never been measured');
  });

  it('warns on an unrecognised scheme, recording it rather than inventing a verdict', () => {
    const v = judgePowerScheme({ guid: '11111111-2222-3333-4444-555555555555', label: 'Custom' });
    expect(v.kind).toBe('warn');
  });

  it('treats a host that cannot report a scheme as ok, not as a failure', () => {
    // Non-Windows CI has no powercfg. Refusing there would make the gate unrunnable; claiming a
    // pass would be a fabricated measurement condition. `null` records "unknown" and moves on.
    expect(judgePowerScheme(null).kind).toBe('ok');
  });

  it('matches on GUID, never on the label, which is localised', () => {
    // The machine that surfaced this reported "Oszczędzanie energii", not "Power saver".
    const v = judgePowerScheme({ guid: POWER_SAVER, label: 'Oszczędzanie energii' });
    expect(v.kind).toBe('refuse');
  });
});

describe('readPowerScheme', () => {
  it('returns a GUID on Windows and null elsewhere, never throwing', () => {
    const s = readPowerScheme();
    if (process.platform !== 'win32') {
      expect(s).toBeNull();
      return;
    }
    expect(s).not.toBeNull();
    expect(s?.guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
