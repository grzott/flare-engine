import { describe, expect, test } from 'bun:test';
import {
  compileLive,
  LIVE_POSE_STRIDE,
  type LivePose,
  livePoseAtInto,
  sampleLivePosesInto,
} from '../../src/core/live';
import { buildArcTable } from '../../src/core/path/arc-table';
import { dust, emerge, fade, type LivePreset, press, slide } from '../../src/core/presets';
import { liveEntries, parallel, sequence } from '../../src/core/timeline';
import { compileTiming, timingAt } from '../../src/core/timing';

const W = 200;
const H = 100;
const ENTER = 1;
const EXIT = -1;

const newPose = (): LivePose => ({
  tx: 0,
  ty: 0,
  rotationDeg: 0,
  rotateXDeg: 0,
  rotateYDeg: 0,
  perspective: 0,
  scale: 0,
  opacity: 0,
  brightness: 0,
  shadowEdge: 0,
  shadowOpacity: 0,
});

const REST_ROW = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0];

const poseAt = (
  input: Parameters<typeof compileLive>[0],
  t: number,
  direction: 1 | -1,
  pressT = 0,
  rtl = false,
): LivePose => livePoseAtInto(compileLive(input, W, H, rtl), t, direction, pressT, newPose());

const rowOf = (pose: LivePose): number[] => [
  pose.tx,
  pose.ty,
  pose.rotationDeg,
  pose.rotateXDeg,
  pose.rotateYDeg,
  pose.perspective,
  pose.scale,
  pose.opacity,
  pose.brightness,
  pose.shadowEdge,
  pose.shadowOpacity,
];

// Heads +x, then turns down: the tangent goes from 0° to 90°.
const TURN = { cubic: [0, 0, 60, 0, 100, 40, 100, 100] };
// Heads -x and dips across the axis: the tangent goes from 168.7° through ±180° to -168.7°.
const BACKWARDS = { cubic: [0, 0, -50, 10, -100, 10, -150, 0] };
const OVERSHOOT = { cubicBezier: [0.3, 1.6, 0.6, 1] } as const;

describe('livePoseAtInto, one preset', () => {
  test('writes into and returns out', () => {
    const out = newPose();
    expect(livePoseAtInto(compileLive(fade(), W, H, false), 0.1, ENTER, 0, out)).toBe(out);
  });

  test('a fade enters from opacity 0 to 1 and touches nothing else', () => {
    expect(poseAt(fade(), 0, ENTER).opacity).toBe(0);
    expect(poseAt(fade(), 0.125, ENTER).opacity).toBeCloseTo(0.5, 6);
    expect(rowOf(poseAt(fade(), 0.25, ENTER))).toEqual(REST_ROW);
  });

  test('a fade exits from 1 to its away opacity and holds it', () => {
    const preset = fade({ opacity: 0.7 });
    expect(poseAt(preset, 0, EXIT).opacity).toBe(1);
    expect(poseAt(preset, 0.25, EXIT).opacity).toBeCloseTo(0.7, 6);
    expect(poseAt(preset, 5, EXIT).opacity).toBeCloseTo(0.7, 6);
  });

  test('a slide enters from the named edge', () => {
    const at0 = (from: 'left' | 'right' | 'top' | 'bottom'): LivePose =>
      poseAt(slide({ from }), 0, ENTER);
    expect(at0('right').tx).toBe(48);
    expect(at0('right').ty).toBe(0);
    expect(at0('left').tx).toBe(-48);
    expect(at0('top').ty).toBe(-48);
    expect(at0('top').tx).toBe(0);
    expect(at0('bottom').ty).toBe(48);
  });

  test('a slide follows its easing to rest, and exits back out', () => {
    const preset = slide({ from: 'right', easing: 'linear', duration: 0.4 });
    expect(poseAt(preset, 0.1, ENTER).tx).toBeCloseTo(36, 4);
    expect(rowOf(poseAt(preset, 0.4, ENTER))).toEqual(REST_ROW);
    expect(poseAt(preset, 0, EXIT).tx).toBe(0);
    expect(poseAt(preset, 0.1, EXIT).tx).toBeCloseTo(12, 4);
    expect(poseAt(preset, 0.4, EXIT).tx).toBe(48);
  });

  test("'start' and 'end' follow the writing direction", () => {
    expect(poseAt(slide({ from: 'start' }), 0, ENTER, 0, true).tx).toBe(48);
    expect(poseAt(slide({ from: 'start' }), 0, ENTER, 0, false).tx).toBe(-48);
    expect(poseAt(slide({ from: 'end' }), 0, ENTER, 0, true).tx).toBe(-48);
    expect(poseAt(slide({ from: 'end' }), 0, ENTER, 0, false).tx).toBe(48);
  });

  test('an { angle, distance } slide starts behind its direction of travel', () => {
    const right = poseAt(slide({ from: { angle: 90, distance: 40 } }), 0, ENTER);
    expect(right.tx).toBeCloseTo(-40, 6);
    expect(right.ty).toBeCloseTo(0, 6);
    const up = poseAt(slide({ from: { angle: 0, distance: 40 } }), 0, ENTER);
    expect(up.tx).toBeCloseTo(0, 6);
    expect(up.ty).toBeCloseTo(40, 6);
  });

  test('an { x, y } slide starts at that pixel offset', () => {
    const pose = poseAt(slide({ from: { x: -30, y: 12 } }), 0, ENTER);
    expect(pose.tx).toBe(-30);
    expect(pose.ty).toBe(12);
  });

  test('a delay holds the away state until it has passed', () => {
    const preset = fade({ delay: 0.1 });
    expect(poseAt(preset, 0.1, ENTER).opacity).toBe(0);
    expect(poseAt(preset, 0.225, ENTER).opacity).toBeCloseTo(0.5, 6);
    expect(poseAt(preset, 0.35, ENTER).opacity).toBe(1);
    expect(poseAt(preset, 0.05, EXIT).opacity).toBe(1);
  });

  test('a preset written by hand takes the default duration of its kind', () => {
    const byHand: LivePreset = { kind: 'fade', opacity: 0 };
    const compiled = compileLive(byHand, W, H, false);
    expect(compiled.duration).toBe(0.25);
    expect(livePoseAtInto(compiled, 0.125, ENTER, 0, newPose()).opacity).toBeCloseTo(0.5, 6);
  });
});

describe('livePoseAtInto, a slide along a path', () => {
  test('the pose is relative to the end of the path', () => {
    const preset = slide({ path: TURN, easing: 'linear' });
    const start = poseAt(preset, 0, ENTER);
    expect(start.tx).toBeCloseTo(-100, 4);
    expect(start.ty).toBeCloseTo(-100, 4);
    expect(start.rotationDeg).toBe(0);
    expect(rowOf(poseAt(preset, 0.35, ENTER))).toEqual(REST_ROW);
    const exited = poseAt(preset, 0.35, EXIT);
    expect(exited.tx).toBeCloseTo(-100, 4);
    expect(exited.ty).toBeCloseTo(-100, 4);
  });

  test('it travels at constant speed along the arc', () => {
    const preset = slide({ path: TURN, easing: 'linear', duration: 0.4 });
    const table = buildArcTable(TURN);
    const samples = compileTiming({ duration: 0.4 }, 0.4).samples;
    // 0.1 s is a sample of the 120 Hz timing table, so the pose there is the path pose itself.
    const eased = timingAt(samples, 0, 0.4, 0.1);
    const cubic = TURN.cubic;
    // Walk the lookup table for the point `eased` of the way along.
    const want = eased * table.total;
    let k = 0;
    while (table.lut[k + 1]! < want) k++;
    const u = (k + (want - table.lut[k]!) / (table.lut[k + 1]! - table.lut[k]!)) / 32;
    const v = 1 - u;
    const at = (i: number): number =>
      v * v * v * cubic[i]! +
      3 * v * v * u * cubic[i + 2]! +
      3 * v * u * u * cubic[i + 4]! +
      u * u * u * cubic[i + 6]!;
    const pose = poseAt(preset, 0.1, ENTER);
    expect(pose.tx).toBeCloseTo(at(0) - 100, 3);
    expect(pose.ty).toBeCloseTo(at(1) - 100, 3);
  });

  test('start and end pick the stretch of the path that is travelled', () => {
    const preset = slide({
      path: { svg: 'M0 0 L100 0' },
      start: 0.25,
      end: 0.75,
      easing: 'linear',
    });
    expect(poseAt(preset, 0, ENTER).tx).toBeCloseTo(-50, 4);
    expect(poseAt(preset, 0.175, ENTER).tx).toBeCloseTo(-25, 4);
    expect(poseAt(preset, 0.35, ENTER).tx).toBe(0);
  });

  test('autoRotate turns with the tangent, measured from the tangent at the end', () => {
    const preset = slide({ path: TURN, autoRotate: true, easing: 'linear' });
    expect(poseAt(preset, 0, ENTER).rotationDeg).toBeCloseTo(-90, 4);
    expect(poseAt(preset, 0.35, ENTER).rotationDeg).toBeCloseTo(0, 6);
    expect(poseAt(preset, 0.35, EXIT).rotationDeg).toBeCloseTo(-90, 4);
  });

  test('a numeric autoRotate adds its offset, and rotationLimit clamps the sum', () => {
    const offset = slide({ path: TURN, autoRotate: 20, easing: 'linear' });
    expect(poseAt(offset, 0, ENTER).rotationDeg).toBeCloseTo(-70, 4);
    expect(poseAt(offset, 0.35, ENTER).rotationDeg).toBeCloseTo(20, 4);
    const limited = slide({ path: TURN, autoRotate: true, rotationLimit: 30, easing: 'linear' });
    expect(poseAt(limited, 0, ENTER).rotationDeg).toBe(-30);
    expect(poseAt(limited, 0.35, ENTER).rotationDeg).toBeCloseTo(0, 6);
  });

  test('alignOrigin is the point of the element that stays on the path while it turns', () => {
    const preset = slide({
      path: TURN,
      autoRotate: true,
      alignOrigin: { x: 0, y: 0 },
      easing: 'linear',
    });
    // The corner sits (-100, -50) from the centre the element turns about; turned -90° that arm
    // is (-50, 100), so the translation makes up the difference on top of the path offset.
    const start = poseAt(preset, 0, ENTER);
    expect(start.tx).toBeCloseTo(-100 + -100 - -50, 3);
    expect(start.ty).toBeCloseTo(-100 + -50 - 100, 3);
    expect(rowOf(poseAt(preset, 0.35, ENTER)).slice(0, 3)).toEqual([0, 0, 0]);
  });

  test('an overshooting easing never flips the rotation between samples', () => {
    for (const path of [TURN, BACKWARDS]) {
      const compiled = compileLive(
        slide({ path, autoRotate: true, easing: OVERSHOOT }),
        W,
        H,
        false,
      );
      const rows = new Float32Array(64 * LIVE_POSE_STRIDE);
      for (const direction of [ENTER, EXIT] as const) {
        const count = sampleLivePosesInto(compiled, direction, 120, rows);
        let overshot = false;
        for (let i = 1; i < count; i++) {
          const before = rows[(i - 1) * LIVE_POSE_STRIDE + 2]!;
          const after = rows[i * LIVE_POSE_STRIDE + 2]!;
          expect(Math.abs(after - before)).toBeLessThan(90);
          if (direction === ENTER && path === TURN && rows[i * LIVE_POSE_STRIDE + 1]! > 0.5) {
            overshot = true;
          }
        }
        if (direction === ENTER && path === TURN) expect(overshot).toBe(true);
      }
    }
  });

  test('a tangent that crosses ±180° turns the short way', () => {
    const preset = slide({ path: BACKWARDS, autoRotate: true, easing: 'linear' });
    // 168.7° at the start against -168.7° at the end is 22.6° apart, not 337.4°.
    expect(poseAt(preset, 0, ENTER).rotationDeg).toBeCloseTo(-22.6199, 3);
  });
});

describe('livePoseAtInto, press', () => {
  test('pressT blends the press pose in, whatever t is', () => {
    const preset = press({ scale: 0.96, opacity: 0.8, brightness: 1.2 });
    expect(rowOf(poseAt(preset, 0.05, ENTER, 0))).toEqual(REST_ROW);
    const pressed = poseAt(preset, 0.05, ENTER, 1);
    expect(pressed.scale).toBeCloseTo(0.96, 6);
    expect(pressed.opacity).toBeCloseTo(0.8, 6);
    expect(pressed.brightness).toBeCloseTo(1.2, 6);
    expect(poseAt(preset, 0, EXIT, 0.5).scale).toBeCloseTo(0.98, 6);
  });

  test('the press pose multiplies the base pose', () => {
    const entries = liveEntries(parallel(fade({ opacity: 0.5 }), press({ opacity: 0.8 })));
    const pose = poseAt(entries, 0, ENTER, 1);
    expect(pose.scale).toBeCloseTo(0.96, 6);
    expect(pose.opacity).toBeCloseTo(0.4, 6);
  });
});

describe('livePoseAtInto, live emerge', () => {
  const preset = emerge();
  const reach = 12 * Math.SQRT1_2;

  test('it enters out of the shadow, along its angle', () => {
    const pose = poseAt(preset, 0, ENTER);
    expect(pose.tx).toBeCloseTo(-reach, 5);
    expect(pose.ty).toBeCloseTo(-reach, 5);
    expect(pose.brightness).toBeCloseTo(0.4, 6);
    expect(pose.shadowEdge).toBe(0);
    expect(pose.shadowOpacity).toBeCloseTo(0.6, 6);
    expect(pose.opacity).toBe(1);
  });

  test('the brightness lags the shadow edge', () => {
    const early = poseAt(preset, 0.09, ENTER);
    expect(early.shadowEdge).toBeCloseTo(0.2, 5);
    expect(early.brightness).toBeCloseTo(0.4, 6);
    const mid = poseAt(preset, 0.225, ENTER);
    expect(mid.tx).toBeCloseTo(-reach / 2, 5);
    expect(mid.shadowEdge).toBeCloseTo(0.5, 6);
    expect(mid.shadowOpacity).toBeCloseTo(0.3, 6);
    expect(mid.brightness).toBeCloseTo(1 - 0.6 * (1 - 0.2 / 0.7), 5);
  });

  test('it rests lit, and exits back into the shadow', () => {
    expect(rowOf(poseAt(preset, 0.45, ENTER))).toEqual(REST_ROW);
    expect(rowOf(poseAt(preset, 0, EXIT))).toEqual(REST_ROW);
    const gone = poseAt(preset, 0.45, EXIT);
    expect(gone.tx).toBeCloseTo(-reach, 5);
    expect(gone.brightness).toBeCloseTo(0.4, 6);
    expect(gone.shadowEdge).toBe(0);
    expect(gone.shadowOpacity).toBeCloseTo(0.6, 6);
  });

  test('a lag of 1 keeps the brightness down until the very end', () => {
    const late = emerge({ shadow: { lag: 1 } });
    expect(poseAt(late, 0.44, ENTER).brightness).toBeCloseTo(0.4, 6);
    expect(poseAt(late, 0.45, ENTER).brightness).toBe(1);
  });
});

describe('compileLive', () => {
  test('one preset lasts its delay plus its duration', () => {
    expect(compileLive(fade(), W, H, false).duration).toBe(0.25);
    expect(compileLive(slide({ delay: 0.1 }), W, H, false).duration).toBeCloseTo(0.45, 12);
  });

  test('one preset keeps its timing table, and a path slide its arc table', () => {
    const plain = compileLive(fade({ delay: 0.1 }), W, H, false);
    expect(plain.timing.delay).toBe(0.1);
    expect(plain.timing.duration).toBe(0.25);
    expect(plain.timing.samples.length).toBe(31);
    expect(plain.path).toBeNull();
    const along = compileLive(slide({ path: TURN }), W, H, false);
    expect(along.path?.total).toBeCloseTo(buildArcTable(TURN).total, 6);
  });

  test('uses3d is false for every preset', () => {
    const presets = [fade(), slide(), slide({ path: TURN, autoRotate: true }), press(), emerge()];
    for (const preset of presets) {
      const compiled = compileLive(preset, W, H, false);
      expect(compiled.uses3d).toBe(false);
      const pose = livePoseAtInto(compiled, 0.1, ENTER, 1, newPose());
      expect(pose.rotateXDeg).toBe(0);
      expect(pose.rotateYDeg).toBe(0);
      expect(pose.perspective).toBe(0);
    }
    expect(compileLive(liveEntries(parallel(fade(), slide())), W, H, false).uses3d).toBe(false);
  });

  test('a list and each kind of preset compile to different kinds', () => {
    const kinds = [
      compileLive(fade(), W, H, false).kind,
      compileLive(slide(), W, H, false).kind,
      compileLive(slide({ path: TURN }), W, H, false).kind,
      compileLive(press(), W, H, false).kind,
      compileLive(emerge(), W, H, false).kind,
      compileLive([{ start: 0, preset: fade() }], W, H, false).kind,
    ];
    expect(kinds).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('a snapshot preset is refused', () => {
    const snapshot = dust() as unknown as LivePreset;
    expect(() => compileLive(snapshot, W, H, false)).toThrow(RangeError);
    const shader = emerge({ variant: 'shader' }) as unknown as LivePreset;
    expect(() => compileLive(shader, W, H, false)).toThrow(RangeError);
  });

  test('an element size that is not a finite number >= 0 is refused', () => {
    expect(() => compileLive(fade(), Number.NaN, H, false)).toThrow(RangeError);
    expect(() => compileLive(fade(), W, -1, false)).toThrow(RangeError);
  });
});

describe('compileLive, a timeline', () => {
  test('parallel entries each keep their own channel', () => {
    const entries = liveEntries(parallel(fade(), slide({ from: 'right' })));
    const both = poseAt(entries, 0.1, ENTER);
    expect(both.opacity).toBe(poseAt(fade(), 0.1, ENTER).opacity);
    expect(both.tx).toBe(poseAt(slide({ from: 'right' }), 0.1, ENTER).tx);
    expect(both.opacity).toBeGreaterThan(0);
    expect(both.opacity).toBeLessThan(1);
    expect(both.tx).toBeGreaterThan(0);
    expect(both.tx).toBeLessThan(48);
  });

  test('an exiting sequence holds each entry at its final pose', () => {
    const entries = liveEntries(sequence(fade({ opacity: 0.7, duration: 0.06 }), slide()));
    expect(poseAt(entries, 0.03, EXIT).opacity).toBeCloseTo(0.85, 5);
    expect(poseAt(entries, 0.03, EXIT).ty).toBe(0);
    for (const t of [0.06, 0.2, 0.41, 1]) {
      expect(poseAt(entries, t, EXIT).opacity).toBeCloseTo(0.7, 6);
    }
    expect(poseAt(entries, 0.41, EXIT).ty).toBe(48);
  });

  test('an entering sequence keeps a later entry away until it starts', () => {
    const entries = liveEntries(sequence(fade({ duration: 0.1 }), slide({ from: 'right' })));
    expect(poseAt(entries, 0.05, ENTER).tx).toBe(48);
    // An entry's own times are Float32, so its end is exact only to a rounding error.
    expect(poseAt(entries, 0.1, ENTER).opacity).toBeCloseTo(1, 6);
    expect(rowOf(poseAt(entries, 0.45, ENTER))).toEqual(REST_ROW);
  });

  test('duration is the latest entry end', () => {
    const entries = [
      { start: 0.2, preset: fade() },
      { start: 0, preset: slide({ delay: 0.3 }) },
    ];
    expect(compileLive(entries, W, H, false).duration).toBeCloseTo(0.65, 12);
    expect(compileLive([], W, H, false).duration).toBe(0);
  });

  test('an empty list is the rest pose', () => {
    expect(rowOf(poseAt([], 0, ENTER, 1))).toEqual(REST_ROW);
  });

  test('translations and rotations add', () => {
    const entries = [
      { start: 0, preset: slide({ from: 'right', duration: 0.2 }) },
      { start: 0, preset: slide({ from: { x: 10, y: -20 }, duration: 0.2 }) },
      { start: 0, preset: slide({ path: TURN, autoRotate: true, duration: 0.2 }) },
      { start: 0, preset: slide({ path: BACKWARDS, autoRotate: true, duration: 0.2 }) },
    ];
    const pose = poseAt(entries, 0, ENTER);
    expect(pose.tx).toBeCloseTo(48 + 10 - 100 + 150, 3);
    expect(pose.ty).toBeCloseTo(-20 - 100, 3);
    expect(pose.rotationDeg).toBeCloseTo(-90 - 22.6199, 3);
  });

  test('opacity and brightness multiply', () => {
    const entries = [
      { start: 0, preset: fade({ opacity: 0.5 }) },
      { start: 0, preset: fade({ opacity: 0.5 }) },
      { start: 0, preset: emerge({ shadow: { opacity: 0.5 } }) },
      { start: 0, preset: emerge({ shadow: { opacity: 0.2 } }) },
    ];
    const pose = poseAt(entries, 0, ENTER);
    expect(pose.opacity).toBeCloseTo(0.25, 6);
    expect(pose.brightness).toBeCloseTo(0.5 * 0.8, 6);
  });

  test('shadow values take the maximum', () => {
    const entries = [
      { start: 0, preset: emerge({ shadow: { opacity: 0.5 }, duration: 0.4 }) },
      { start: 0, preset: emerge({ shadow: { opacity: 0.2 }, duration: 0.2 }) },
      { start: 0, preset: fade() },
    ];
    const pose = poseAt(entries, 0.1, ENTER);
    expect(pose.shadowEdge).toBeCloseTo(0.5, 6);
    expect(pose.shadowOpacity).toBeCloseTo(0.375, 6);
  });
});

describe('sampleLivePosesInto', () => {
  test('a 0.25 s fade at 60 fps is 16 rows, the last one the rest pose', () => {
    const compiled = compileLive(fade(), W, H, false);
    const rows = new Float32Array(16 * LIVE_POSE_STRIDE);
    expect(sampleLivePosesInto(compiled, ENTER, 60, rows)).toBe(16);
    expect([...rows.subarray(15 * LIVE_POSE_STRIDE)]).toEqual(REST_ROW);
    expect(rows[7]).toBe(0);
    expect(rows[3 * LIVE_POSE_STRIDE + 7]).toBeCloseTo(0.2, 6);
  });

  test('rows hold the pose fields in order', () => {
    expect(LIVE_POSE_STRIDE).toBe(11);
    expect(Object.keys(newPose())).toHaveLength(LIVE_POSE_STRIDE);
    const compiled = compileLive(emerge(), W, H, false);
    const rows = new Float32Array(32 * LIVE_POSE_STRIDE);
    const count = sampleLivePosesInto(compiled, EXIT, 60, rows);
    expect(count).toBe(28);
    for (const i of [0, 9, 27]) {
      const pose = livePoseAtInto(compiled, Math.min(i / 60, 0.45), EXIT, 0, newPose());
      const row = [...rows.subarray(i * LIVE_POSE_STRIDE, (i + 1) * LIVE_POSE_STRIDE)];
      expect(row).toEqual(rowOf(pose).map(Math.fround));
    }
  });

  test('a duration between two frames still ends on the final pose', () => {
    const compiled = compileLive(fade({ duration: 0.26 }), W, H, false);
    const rows = new Float32Array(17 * LIVE_POSE_STRIDE);
    expect(sampleLivePosesInto(compiled, ENTER, 60, rows)).toBe(17);
    expect([...rows.subarray(16 * LIVE_POSE_STRIDE)]).toEqual(REST_ROW);
  });

  test('an instant preset is one row', () => {
    const compiled = compileLive(fade({ duration: 0 }), W, H, false);
    const rows = new Float32Array(LIVE_POSE_STRIDE);
    expect(sampleLivePosesInto(compiled, EXIT, 60, rows)).toBe(1);
    expect(rows[7]).toBe(0);
  });

  test('an out too short for the rows, or a frame rate not above 0, is refused', () => {
    const compiled = compileLive(fade(), W, H, false);
    expect(() =>
      sampleLivePosesInto(compiled, ENTER, 60, new Float32Array(15 * LIVE_POSE_STRIDE)),
    ).toThrow(RangeError);
    const rows = new Float32Array(16 * LIVE_POSE_STRIDE);
    expect(() => sampleLivePosesInto(compiled, ENTER, 0, rows)).toThrow(RangeError);
    expect(() => sampleLivePosesInto(compiled, ENTER, Number.NaN, rows)).toThrow(RangeError);
  });
});
