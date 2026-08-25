import { describe, expect, it } from 'bun:test';
import { devtoolsSocketPublished, verifyAppended } from '../scripts/capture.js';

/**
 * Cover for the capture guard added 2026-08-25, after a session in which the runner's exit code
 * was wrong in both directions on the same day:
 *
 *   - `bench:web:gpu` wrote all 18 records, then Bun panicked at teardown and exited 3.
 *   - Five Android captures exited 1 having appended nothing, each slow enough to look like work.
 *
 * The guard therefore decides from the lane history, never from the exit code. These tests pin
 * the four shapes it must tell apart.
 */

const stamp = '2026-08-25T06:38:52.296Z';

function rec(capturedAt: string, name: string): string {
  return JSON.stringify({ capturedAt, name, p50Ms: 1.23 });
}

describe('verifyAppended', () => {
  it('accepts a capture whose records all share one capturedAt', () => {
    const after = [rec(stamp, 'a'), rec(stamp, 'b'), rec(stamp, 'c')];
    const v = verifyAppended(0, after);
    expect(v.ok).toBe(true);
    expect(v.appended).toBe(3);
  });

  it('counts only what THIS capture appended, ignoring prior history', () => {
    const prior = [rec('2026-08-24T00:00:00.000Z', 'old')];
    const after = [...prior, rec(stamp, 'a'), rec(stamp, 'b')];
    const v = verifyAppended(prior.length, after);
    expect(v.ok).toBe(true);
    expect(v.appended).toBe(2);
  });

  it('REFUSES a capture that appended nothing — the run measured nothing', () => {
    // The exact shape of the five failed Android runs: the process ran, took real time, and
    // wrote zero records. Folding after this republishes the previous window as current.
    const history = [rec('2026-08-24T00:00:00.000Z', 'old')];
    const v = verifyAppended(history.length, history);
    expect(v.ok).toBe(false);
    expect(v.appended).toBe(0);
    expect(v.reason).toContain('appended NO records');
  });

  it('refuses a truncated write — an appended line that does not parse', () => {
    const after = [rec(stamp, 'a'), '{"capturedAt":"2026-08-25T06:38:52.296Z","nam'];
    const v = verifyAppended(0, after);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('truncated');
  });

  it('refuses appended records that carry no capturedAt — provenance is incomplete', () => {
    const after = [rec(stamp, 'a'), JSON.stringify({ name: 'b', p50Ms: 1 })];
    const v = verifyAppended(0, after);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('capturedAt');
  });

  it('refuses a window spanning two capturedAt values — two runs interleaved as one', () => {
    const after = [rec(stamp, 'a'), rec('2026-08-25T07:00:00.000Z', 'b')];
    const v = verifyAppended(0, after);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('distinct capturedAt');
  });

  it('refuses a history that shrank during the capture', () => {
    const v = verifyAppended(5, [rec(stamp, 'a')]);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('SHRANK');
  });
});

describe('devtoolsSocketPublished', () => {
  it('detects the socket in real /proc/net/unix output', () => {
    const out = [
      'Num       RefCount Protocol Flags    Type St Inode Path',
      'ffff0001: 00000002 00000000 00010000 0001 01 123456 @chrome_devtools_remote',
      'ffff0002: 00000002 00000000 00010000 0001 01 123457 /dev/socket/logd',
    ].join('\n');
    expect(devtoolsSocketPublished(out)).toBe(true);
  });

  it('returns false when Chrome is backgrounded and has dropped the socket', () => {
    // Chrome keeps its process when backgrounded, so a pid check would pass here — this is the
    // state that produced five silent Android failures.
    const out = [
      'Num       RefCount Protocol Flags    Type St Inode Path',
      'ffff0002: 00000002 00000000 00010000 0001 01 123457 /dev/socket/logd',
    ].join('\n');
    expect(devtoolsSocketPublished(out)).toBe(false);
  });

  it('returns false for empty output', () => {
    expect(devtoolsSocketPublished('')).toBe(false);
  });
});
