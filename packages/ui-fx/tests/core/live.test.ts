import { describe, expect, test } from 'bun:test';
import {
  compileLive,
  LIVE_POSE_STRIDE,
  type LivePose,
  livePoseAtInto,
  sampleLivePosesInto,
  transformOriginOf,
} from '../../src/core/live';
import { buildArcTable } from '../../src/core/path/arc-table';
import { dust, emerge, fade, flip, type LivePreset, press, slide } from '../../src/core/presets';
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

describe('livePoseAtInto, flip', () => {
  // The rest pose, but for the perspective a flip keeps from start to end.
  const FLAT_ROW = [0, 0, 0, 0, 0, 800, 1, 1, 1, 1, 0];
  const linear = (o: Parameters<typeof flip>[0] = {}) =>
    flip({ easing: 'linear', duration: 0.4, ...o });
  // smoothstep(0, 0.25, cos(rotation)), as the spec writes the edge fade.
  const facing = (rotationDeg: number): number => {
    const x = Math.min(Math.max(Math.cos((rotationDeg * Math.PI) / 180) / 0.25, 0), 1);
    return x * x * (3 - 2 * x);
  };

  test('it enters edge-on and invisible, and rests flat and opaque', () => {
    const start = poseAt(flip(), 0, ENTER);
    expect(start.rotateYDeg).toBe(90);
    expect(start.rotateXDeg).toBe(0);
    expect(start.opacity).toBeCloseTo(0, 6);
    expect(start.perspective).toBe(800);
    expect(rowOf(poseAt(flip(), 0.45, ENTER))).toEqual(FLAT_ROW);
    expect(rowOf(poseAt(flip(), 5, ENTER))).toEqual(FLAT_ROW);
  });

  test('the rotation follows the easing, and the opacity the cosine of the rotation', () => {
    const half = poseAt(linear(), 0.2, ENTER);
    expect(half.rotateYDeg).toBeCloseTo(45, 4);
    expect(half.opacity).toBe(1);
    const early = poseAt(linear(), 0.04, ENTER);
    expect(early.rotateYDeg).toBeCloseTo(81, 4);
    expect(early.opacity).toBeCloseTo(facing(81), 4);
    expect(early.opacity).toBeGreaterThan(0);
    expect(early.opacity).toBeLessThan(1);
    expect(early.perspective).toBe(800);
  });

  test('it exits from rest to the same away rotation', () => {
    expect(rowOf(poseAt(linear(), 0, EXIT))).toEqual(FLAT_ROW);
    expect(poseAt(linear(), 0.1, EXIT).rotateYDeg).toBeCloseTo(22.5, 4);
    const gone = poseAt(linear(), 0.4, EXIT);
    expect(gone.rotateYDeg).toBe(90);
    expect(gone.opacity).toBeCloseTo(0, 6);
    expect(gone.perspective).toBe(800);
  });

  test("axis 'x' drives rotateXDeg only", () => {
    const start = poseAt(flip({ axis: 'x' }), 0, ENTER);
    expect(start.rotateXDeg).toBe(90);
    expect(start.rotateYDeg).toBe(0);
    expect(start.rotationDeg).toBe(0);
    expect(start.opacity).toBeCloseTo(0, 6);
    expect(poseAt(linear({ axis: 'x' }), 0.2, ENTER).rotateXDeg).toBeCloseTo(45, 4);
    expect(poseAt(linear({ axis: 'x' }), 0.2, ENTER).rotateYDeg).toBe(0);
  });

  test('it leaves the translation, the scale and the brightness alone', () => {
    const pose = poseAt(linear(), 0.1, ENTER);
    expect([pose.tx, pose.ty, pose.rotationDeg, pose.scale, pose.brightness]).toEqual([
      0, 0, 0, 1, 1,
    ]);
    expect([pose.shadowEdge, pose.shadowOpacity]).toEqual([1, 0]);
  });

  test('without fadeAtEdge the opacity stays 1', () => {
    const preset = flip({ fadeAtEdge: false });
    expect(poseAt(preset, 0, ENTER).opacity).toBe(1);
    expect(poseAt(preset, 0, ENTER).rotateYDeg).toBe(90);
    expect(poseAt(preset, 0.45, EXIT).opacity).toBe(1);
  });

  test('a negative angle turns the other way and fades the same', () => {
    const start = poseAt(linear({ angle: -90 }), 0, ENTER);
    expect(start.rotateYDeg).toBe(-90);
    expect(start.opacity).toBeCloseTo(0, 6);
    const early = poseAt(linear({ angle: -90 }), 0.04, ENTER);
    expect(early.rotateYDeg).toBeCloseTo(-81, 4);
    expect(early.opacity).toBeCloseTo(facing(81), 4);
  });

  test('past edge-on the back face stays invisible', () => {
    const preset = linear({ angle: 180 });
    expect(poseAt(preset, 0, ENTER).rotateYDeg).toBe(180);
    expect(poseAt(preset, 0, ENTER).opacity).toBe(0);
    expect(poseAt(preset, 0.1, ENTER).opacity).toBe(0);
    expect(poseAt(preset, 0.2, ENTER).opacity).toBeCloseTo(0, 6);
    expect(poseAt(preset, 0.3, ENTER).opacity).toBe(1);
    expect(poseAt(linear({ angle: -180 }), 0.1, EXIT).opacity).toBe(1);
    expect(poseAt(linear({ angle: -180 }), 0.4, EXIT).opacity).toBe(0);
  });

  test('an angle of 0 never leaves rest', () => {
    for (const t of [0, 0.2, 0.4]) {
      expect(rowOf(poseAt(linear({ angle: 0 }), t, ENTER))).toEqual(FLAT_ROW);
      expect(rowOf(poseAt(linear({ angle: 0 }), t, EXIT))).toEqual(FLAT_ROW);
    }
  });

  test('a delay holds the away state until it has passed', () => {
    const preset = linear({ delay: 0.1 });
    expect(poseAt(preset, 0.1, ENTER).rotateYDeg).toBe(90);
    expect(poseAt(preset, 0.3, ENTER).rotateYDeg).toBeCloseTo(45, 4);
    expect(poseAt(preset, 0.05, EXIT).rotateYDeg).toBe(0);
  });

  test('its perspective is the one given', () => {
    expect(poseAt(flip({ perspective: 100 }), 0.1, ENTER).perspective).toBe(100);
  });

  test('pressT does not move it', () => {
    expect(rowOf(poseAt(linear(), 0.1, ENTER, 1))).toEqual(rowOf(poseAt(linear(), 0.1, ENTER, 0)));
  });
});

describe('transformOriginOf', () => {
  const originOf = (
    input: Parameters<typeof compileLive>[0],
    press: { x: number; y: number } | null = null,
  ): string | null => transformOriginOf(compileLive(input, W, H, false), press);

  test('a preset without an origin asks for nothing, and the centre for the centre', () => {
    expect(originOf(flip())).toBe('50% 50%');
    expect(originOf(flip(), { x: 12, y: 5 })).toBe('50% 50%');
    expect(originOf(fade())).toBeNull();
    expect(originOf(slide(), { x: 12, y: 5 })).toBeNull();
    expect(originOf([])).toBeNull();
  });

  test('an { x, y } origin is a percentage of the element', () => {
    expect(originOf(flip({ origin: { x: 0, y: 1 } }))).toBe('0% 100%');
    expect(originOf(flip({ origin: { x: 0.25, y: 0.5 } }))).toBe('25% 50%');
    expect(originOf(flip({ origin: { x: -0.5, y: 2 } }))).toBe('-50% 200%');
    expect(originOf(flip({ origin: { x: 0.5, y: 0.5 } }), { x: 12, y: 5 })).toBe('50% 50%');
  });

  test("'press' is the press point in pixels, or the centre without one", () => {
    expect(originOf(flip({ origin: 'press' }), { x: 12, y: 5 })).toBe('12px 5px');
    expect(originOf(flip({ origin: 'press' }), { x: 0, y: 0 })).toBe('0px 0px');
    expect(originOf(flip({ origin: 'press' }))).toBe('50% 50%');
  });

  test('a list takes the origin of its first flip', () => {
    const entries = [
      { start: 0, preset: fade() },
      { start: 0, preset: flip({ origin: { x: 0, y: 0 } }) },
      { start: 0, preset: flip({ origin: { x: 1, y: 1 } }) },
    ];
    expect(originOf(entries)).toBe('0% 0%');
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

  test('uses3d is true for a flip, alone or in a list', () => {
    expect(compileLive(flip(), W, H, false).uses3d).toBe(true);
    expect(compileLive(flip({ angle: 0 }), W, H, false).uses3d).toBe(true);
    expect(compileLive(liveEntries(parallel(fade(), flip())), W, H, false).uses3d).toBe(true);
  });

  test('a flip compiles to a kind of its own, and lasts 0.45 s', () => {
    const compiled = compileLive(flip(), W, H, false);
    expect(compiled.kind).toBe(6);
    expect(compiled.duration).toBe(0.45);
    expect(compiled.path).toBeNull();
  });

  test('origin is that of the first flip, or null without one', () => {
    expect(compileLive(fade(), W, H, false).origin).toBeNull();
    expect(compileLive(flip(), W, H, false).origin).toBe('center');
    expect(compileLive(flip({ origin: 'press' }), W, H, false).origin).toBe('press');
    const origin = { x: 0, y: 1 };
    const byHand: LivePreset = { ...flip(), origin };
    const compiled = compileLive(byHand, W, H, false);
    expect(compiled.origin).toEqual({ x: 0, y: 1 });
    // A copy: a compiled preset is handed to the UI runtime, which freezes what it is given.
    expect(compiled.origin).not.toBe(origin);
  });

  test('uses3d is false for every preset but a flip', () => {
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

  test('flips add their rotations per axis, and the smallest perspective wins', () => {
    const entries = [
      { start: 0, preset: flip({ fadeAtEdge: false }) },
      { start: 0, preset: flip({ angle: 30, perspective: 400, fadeAtEdge: false }) },
      { start: 0, preset: flip({ axis: 'x', angle: -45, perspective: 600, fadeAtEdge: false }) },
      { start: 0, preset: fade({ opacity: 0.5 }) },
    ];
    const pose = poseAt(entries, 0, ENTER);
    expect(pose.rotateYDeg).toBe(120);
    expect(pose.rotateXDeg).toBe(-45);
    expect(pose.perspective).toBe(400);
    expect(pose.opacity).toBeCloseTo(0.5, 6);
  });

  test('the edge fade of a flip multiplies the opacity of the other entries', () => {
    const entries = [
      { start: 0, preset: flip({ angle: 80, easing: 'linear' }) },
      { start: 0, preset: fade({ opacity: 0.5 }) },
    ];
    const edge = Math.cos((80 * Math.PI) / 180) / 0.25;
    expect(poseAt(entries, 0, ENTER).opacity).toBeCloseTo(0.5 * edge * edge * (3 - 2 * edge), 5);
  });

  test('a list without a flip has no perspective', () => {
    expect(poseAt(liveEntries(parallel(fade(), slide())), 0.1, ENTER).perspective).toBe(0);
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

  test('the rows of a flip carry its rotation, perspective and opacity', () => {
    const compiled = compileLive(flip(), W, H, false);
    const rows = new Float32Array(32 * LIVE_POSE_STRIDE);
    const count = sampleLivePosesInto(compiled, ENTER, 60, rows);
    expect(count).toBe(28);
    expect(rows[4]).toBe(90);
    expect(rows[5]).toBe(800);
    expect(rows[7]).toBeCloseTo(0, 6);
    expect([...rows.subarray(27 * LIVE_POSE_STRIDE, 28 * LIVE_POSE_STRIDE)]).toEqual([
      0, 0, 0, 0, 0, 800, 1, 1, 1, 1, 0,
    ]);
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
