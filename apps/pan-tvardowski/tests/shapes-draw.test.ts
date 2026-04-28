import { describe, expect, it } from 'bun:test';
import { argbTo, shapeBoundsRadius } from '../src/shapes-draw';

describe('argbTo', () => {
  it('converts opaque red 0xffff0000 to RGBA [1, 0, 0, 1]', () => {
    const buf = new Float32Array(4);
    argbTo(buf, 0xffff0000);
    // ARGB 0xffff0000: A=0xff, R=0xff, G=0x00, B=0x00
    // argbTo lays out: [R, G, B, A]
    expect(buf[0]).toBeCloseTo(1, 5); // R
    expect(buf[1]).toBeCloseTo(0, 5); // G
    expect(buf[2]).toBeCloseTo(0, 5); // B
    expect(buf[3]).toBeCloseTo(1, 5); // A
  });
});

describe('shapeBoundsRadius', () => {
  it('circle with r=10 returns >= 10', () => {
    const result = shapeBoundsRadius([{ kind: 'circle', r: 10 }]);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('star with rOuter=20 returns >= 20', () => {
    const result = shapeBoundsRadius([{ kind: 'star', points: 5, rOuter: 20, rInner: 8 }]);
    expect(result).toBeGreaterThanOrEqual(20);
  });

  it('polyline spanning 100 units returns >= 100', () => {
    const result = shapeBoundsRadius([
      { kind: 'polyline', points: [0, 0, 100, 100], strokeWidth: 2 },
    ]);
    expect(result).toBeGreaterThanOrEqual(100);
  });
});
