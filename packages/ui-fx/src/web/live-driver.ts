import {
  type CompiledLive,
  LIVE_POSE_STRIDE,
  type LivePose,
  livePoseAtInto,
  sampleLivePosesInto,
} from '../core/live';
import type { LiveDriver, ProgressSource } from '../runtime/contracts';

// Poses sampled per second of animation. The browser interpolates linearly between them.
const FPS = 60;

// Columns of a pose row: the `LivePose` fields, in field order.
const TX = 0;
const TY = 1;
const ROTATION = 2;
const ROTATE_X = 3;
const ROTATE_Y = 4;
const PERSPECTIVE = 5;
const SCALE = 6;
const OPACITY = 7;
const BRIGHTNESS = 8;

const _press: LivePose = {
  tx: 0,
  ty: 0,
  rotationDeg: 0,
  rotateXDeg: 0,
  rotateYDeg: 0,
  perspective: 0,
  scale: 1,
  opacity: 1,
  brightness: 1,
  shadowEdge: 1,
  shadowOpacity: 0,
};

const ignoreCancelled = (): void => {};

/**
 * The Web Animations keyframes of `count` pose rows, as `sampleLivePosesInto` writes them: one
 * keyframe per row, with no `offset`, so they are evenly spaced unless the caller sets one.
 *
 * `transform` is for `composite: 'add'`, on top of the element's own transform. Its keyframes are
 * `translate(Xpx, Ypx) rotate(Rdeg) scale(S)`; when any row has a perspective or turns about x
 * or y, every one is instead
 * `perspective(Ppx) translate(Xpx, Ypx) rotateX(Adeg) rotateY(Bdeg) rotate(Rdeg) scale(S)`.
 *
 * `paint` is for `composite: 'replace'`. Its keyframes are `{ opacity }`, with a
 * `filter: 'brightness(B)'` on every one when any row has a brightness other than 1.
 *
 * Either way the function list is the same in every keyframe, so the browser interpolates
 * function by function.
 */
export function poseRowsToKeyframes(
  rows: Float32Array,
  count: number,
): { transform: Keyframe[]; paint: Keyframe[] } {
  let uses3d = false;
  let darkens = false;
  for (let i = 0; i < count; i++) {
    const o = i * LIVE_POSE_STRIDE;
    if (rows[o + ROTATE_X]! !== 0 || rows[o + ROTATE_Y]! !== 0 || rows[o + PERSPECTIVE]! !== 0) {
      uses3d = true;
    }
    if (rows[o + BRIGHTNESS]! !== 1) darkens = true;
  }

  const transform: Keyframe[] = [];
  const paint: Keyframe[] = [];
  for (let i = 0; i < count; i++) {
    const o = i * LIVE_POSE_STRIDE;
    const translate = `translate(${rows[o + TX]!}px, ${rows[o + TY]!}px)`;
    const flat = `rotate(${rows[o + ROTATION]!}deg) scale(${rows[o + SCALE]!})`;
    transform.push({
      transform: uses3d
        ? `perspective(${rows[o + PERSPECTIVE]!}px) ${translate} rotateX(${rows[o + ROTATE_X]!}deg) rotateY(${rows[o + ROTATE_Y]!}deg) ${flat}`
        : `${translate} ${flat}`,
    });
    const opacity = rows[o + OPACITY]!;
    paint.push(darkens ? { opacity, filter: `brightness(${rows[o + BRIGHTNESS]!})` } : { opacity });
  }
  return { transform, paint };
}

/**
 * Put each keyframe at the time its row was sampled: row `i` at `i / FPS` seconds, the last at
 * the duration, which is less than a frame after the one before it unless the duration is a
 * whole number of frames.
 */
function placeKeyframes(frames: Keyframe[], seconds: number): void {
  const last = frames.length - 1;
  for (let i = 0; i < last; i++) frames[i]!.offset = i / (FPS * seconds);
  if (last >= 0) frames[last]!.offset = 1;
}

/** The keyframe of the press pose of `c` blended in by `blend`, 0..1. */
function pressKeyframe(c: CompiledLive, blend: number, filtered: boolean): Keyframe {
  // At its duration every entry but a press is at rest, so only the press blend is left.
  livePoseAtInto(c, c.duration, 1, blend, _press);
  const transform = `scale(${_press.scale})`;
  if (!filtered) return { transform };
  return { transform, filter: `opacity(${_press.opacity}) brightness(${_press.brightness})` };
}

interface Playing {
  id: number;
  onEnd(finished: boolean): void;
}

/**
 * The Web Animations live driver of one element, for react-native-web and React DOM alike.
 *
 * A play samples the compiled pose 60 times a second into two animations that hold their ends:
 * the transform, added on top of the element's own, and the opacity (with the brightness of an
 * emerge), which replaces the element's own for as long as the animation is held.
 *
 * A play on its own clock ends through `onEnd` exactly once: `true` when both animations ran
 * out, `false` when `cancel`, `reverse` or another `play` got there first. A play that follows
 * `progress` stays paused and is moved once per animation frame; it has no end of its own, only
 * `cancel` or another `play` ends it, and `reverse` leaves it alone. `dispose` ends nothing and
 * removes every animation the driver made.
 *
 * The press pose is a third animation, added on top: its scale multiplies the transform, and its
 * opacity and brightness multiply through `filter`. An emerge that starts while a press with
 * opacity or brightness is held replaces that filter until the next press or release.
 *
 * `hidden` is a plain box. `hideSync` applies it as the element's inline `visibility`, which no
 * animation here touches.
 */
export function createWebLiveDriver(el: HTMLElement): LiveDriver {
  const hidden = { value: 0 };
  let serial = 0;
  let playing: Playing | null = null;
  let transform: Animation | null = null;
  let paint: Animation | null = null;
  let durationMs = 0;

  let progress: ProgressSource | null = null;
  let frame = 0;
  let scrubbedMs = Number.NaN;

  let pressPose: CompiledLive | null = null;
  let pressAnimation: Animation | null = null;
  let pressFrom = 0;
  let pressTo = 0;
  let pressMs = 0;

  const endPlaying = (finished: boolean): void => {
    const ended = playing;
    playing = null;
    ended?.onEnd(finished);
  };

  // Made once, so following `progress` allocates nothing per frame.
  const scrub = (): void => {
    frame = 0;
    if (progress === null || transform === null || paint === null) return;
    const ms = progress.value * durationMs;
    if (ms !== scrubbedMs) {
      scrubbedMs = ms;
      transform.currentTime = ms;
      paint.currentTime = ms;
    }
    frame = requestAnimationFrame(scrub);
  };

  const stopScrubbing = (): void => {
    progress = null;
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  };

  /** How far the press pose is blended in right now, 0..1. */
  const pressBlend = (): number => {
    if (pressAnimation === null) return 0;
    const time = pressAnimation.currentTime;
    const ms = typeof time === 'number' ? time : 0;
    const done = pressMs > 0 ? Math.min(Math.max(ms / pressMs, 0), 1) : 1;
    return pressFrom + (pressTo - pressFrom) * done;
  };

  return {
    hidden,
    play(c, direction, o) {
      endPlaying(false);
      stopScrubbing();
      transform?.cancel();
      paint?.cancel();

      const id = ++serial;
      playing = { id, onEnd: o.onEnd };
      // One row more than `sampleLivePosesInto` can need, so its row count is not repeated here.
      const rows = new Float32Array((Math.ceil(c.duration * FPS) + 2) * LIVE_POSE_STRIDE);
      const frames = poseRowsToKeyframes(rows, sampleLivePosesInto(c, direction, FPS, rows));
      placeKeyframes(frames.transform, c.duration);
      placeKeyframes(frames.paint, c.duration);
      durationMs = c.duration * 1000;

      const played = el.animate(frames.transform, {
        duration: durationMs,
        fill: 'both',
        easing: 'linear',
        composite: 'add',
      });
      const painted = el.animate(frames.paint, {
        duration: durationMs,
        fill: 'both',
        easing: 'linear',
        composite: 'replace',
      });
      transform = played;
      paint = painted;

      if (o.progress !== undefined) {
        played.pause();
        painted.pause();
        progress = o.progress;
        scrubbedMs = Number.NaN;
        scrub();
        return;
      }
      // A cancelled animation rejects `finished`; whatever cancelled it has ended the play.
      Promise.all([played.finished, painted.finished]).then(() => {
        if (playing !== null && playing.id === id) endPlaying(true);
      }, ignoreCancelled);
    },
    reverse() {
      if (progress !== null) return;
      transform?.reverse();
      paint?.reverse();
      endPlaying(false);
    },
    setPressed(pressed, c) {
      const from = pressBlend();
      if (c !== null) pressPose = c;
      if (pressPose === null) return;
      pressAnimation?.cancel();
      pressFrom = from;
      pressTo = pressed ? 1 : 0;
      pressMs = pressPose.duration * 1000;

      livePoseAtInto(pressPose, pressPose.duration, 1, 1, _press);
      // Added filter lists concatenate, so these multiply what is already there. An added
      // `opacity` would sum instead.
      const filtered = _press.opacity !== 1 || _press.brightness !== 1;
      pressAnimation = el.animate(
        [
          pressKeyframe(pressPose, pressFrom, filtered),
          pressKeyframe(pressPose, pressTo, filtered),
        ],
        { duration: pressMs, fill: 'both', easing: 'linear', composite: 'add' },
      );
    },
    hideSync() {
      el.style.visibility = hidden.value === 1 ? 'hidden' : '';
    },
    cancel() {
      if (playing === null) return;
      stopScrubbing();
      transform?.pause();
      paint?.pause();
      endPlaying(false);
    },
    dispose() {
      playing = null;
      stopScrubbing();
      transform?.cancel();
      paint?.cancel();
      pressAnimation?.cancel();
      transform = null;
      paint = null;
      pressAnimation = null;
    },
  };
}
