import { describe, expect, it } from 'bun:test';
import { parseAdbDevices } from '../scripts/run.js';

/** Real `adb devices` output shapes, including the states that are NOT usable. */
const HEADER = 'List of devices attached';

describe('parseAdbDevices', () => {
  it('returns the serial of a single authorised device', () => {
    expect(parseAdbDevices(`${HEADER}\n27221FDH2004W7\tdevice\n\n`)).toEqual(['27221FDH2004W7']);
  });

  it('returns nothing when no device is attached', () => {
    expect(parseAdbDevices(`${HEADER}\n\n`)).toEqual([]);
  });

  it('ignores an unauthorised device — the RSA prompt was never accepted', () => {
    // This is the state that matters most: the phone is plugged in and visible, so a naive parser
    // reports it as ready and the run fails much later, mid-capture, with a confusing error.
    expect(parseAdbDevices(`${HEADER}\n27221FDH2004W7\tunauthorized\n\n`)).toEqual([]);
  });

  it('ignores offline and no-permissions devices', () => {
    const out = `${HEADER}\nAAA\toffline\nBBB\tno permissions (user in plugdev group)\n\n`;
    expect(parseAdbDevices(out)).toEqual([]);
  });

  it('returns every authorised serial so the caller can refuse an ambiguous run', () => {
    const out = `${HEADER}\nAAA\tdevice\nBBB\tdevice\n\n`;
    expect(parseAdbDevices(out)).toEqual(['AAA', 'BBB']);
  });

  it('keeps only the authorised one when states are mixed', () => {
    const out = `${HEADER}\nAAA\tunauthorized\nBBB\tdevice\nCCC\toffline\n\n`;
    expect(parseAdbDevices(out)).toEqual(['BBB']);
  });

  it('does not mistake a device whose serial merely ends in "device"', () => {
    // `endsWith('\tdevice')` rather than `includes('device')`: a serial can contain the word.
    const out = `${HEADER}\nmydevice\tunauthorized\n\n`;
    expect(parseAdbDevices(out)).toEqual([]);
  });
});
