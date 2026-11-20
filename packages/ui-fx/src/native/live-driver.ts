import { useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import {
  type AnimatedStyle,
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type CompiledLive, type LivePose, livePoseAtInto } from '../core/live';
import type { LiveDriver, ProgressSource } from '../runtime/contracts';

// React Native has no "no perspective"; this is far enough away to be flat.
const FLAT_PERSPECTIVE = 100000;

const restPose = (): LivePose => ({
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
});

// Scratch for the style worklet. The UI runtime gets its own copies, so only the worklet may
// write them: once a worklet has captured an object, the JS thread's original is read-only.
const _pose = /* @__PURE__ */ restPose();
const _press = /* @__PURE__ */ restPose();

interface Playing {
  id: number;
  onEnd(finished: boolean): void;
}

interface DriverState {
  serial: number;
  playing: Playing | null;
  /** The running play follows an external progress value, so no timing of its own runs. */
  scrubbed: boolean;
  pressSeconds: number;
}

/**
 * The Reanimated live driver of one element, and the animated style to put on its host view.
 *
 * The style owns `opacity` and `transform`, and so overrides those two keys of any style listed
 * before it. The transform list always has the same seven entries, `perspective`, `translateX`,
 * `translateY`, `rotateX`, `rotateY`, `rotate` and `scale`, whatever plays.
 *
 * A play on its own clock ends through `onEnd` exactly once: `true` when the timing ran out,
 * `false` when `cancel`, `reverse` or another `play` got there first. A play that follows
 * `progress` has no end of its own; only `cancel` or another `play` ends it. `dispose` ends
 * nothing.
 */
export function useNativeLiveDriver(): { driver: LiveDriver; style: AnimatedStyle<ViewStyle> } {
  const t = useSharedValue(0);
  const dir = useSharedValue<1 | -1>(1);
  const pressT = useSharedValue(0);
  const hidden = useSharedValue(0);
  const compiled = useSharedValue<CompiledLive | null>(null);
  const pressPose = useSharedValue<CompiledLive | null>(null);
  // A worklet can only read a shared value it captured, so the progress source is a dependency
  // of the style worklet instead of a value handed to it.
  const [progress, setProgress] = useState<ProgressSource | null>(null);

  const created = useRef<LiveDriver | null>(null);
  if (created.current === null) {
    const state: DriverState = { serial: 0, playing: null, scrubbed: false, pressSeconds: 0 };

    const endPlaying = (finished: boolean): void => {
      const playing = state.playing;
      state.playing = null;
      playing?.onEnd(finished);
    };
    // A timing that was interrupted answers late, after its play has already been ended.
    const settle = (id: number, finished: boolean): void => {
      if (state.playing !== null && state.playing.id === id) endPlaying(finished);
    };

    created.current = {
      hidden,
      play(c, direction, o) {
        endPlaying(false);
        const id = ++state.serial;
        state.playing = { id, onEnd: o.onEnd };
        state.scrubbed = o.progress !== undefined;
        compiled.value = c;
        dir.value = direction;
        setProgress(o.progress ?? null);
        if (o.progress !== undefined) {
          cancelAnimation(t);
          return;
        }
        t.value = 0;
        t.value = withTiming(
          c.duration,
          { duration: c.duration * 1000, easing: Easing.linear },
          (finished) => {
            'worklet';
            scheduleOnRN(settle, id, finished === true);
          },
        );
      },
      reverse() {
        if (state.scrubbed) return;
        // Running `t` back to 0 retraces the poses already shown, whatever the easing.
        t.value = withTiming(0, { duration: t.value * 1000, easing: Easing.linear });
        endPlaying(false);
      },
      setPressed(pressed, c) {
        if (c !== null) {
          pressPose.value = c;
          state.pressSeconds = c.duration;
        }
        pressT.value = withTiming(pressed ? 1 : 0, {
          duration: state.pressSeconds * 1000,
          easing: Easing.linear,
        });
      },
      hideSync() {},
      cancel() {
        if (state.playing === null) return;
        cancelAnimation(t);
        endPlaying(false);
      },
      dispose() {
        state.playing = null;
        cancelAnimation(t);
        cancelAnimation(pressT);
      },
    };
  }

  const style = useAnimatedStyle((): ViewStyle => {
    'worklet';
    let tx = 0;
    let ty = 0;
    let rotation = 0;
    let rotateX = 0;
    let rotateY = 0;
    let perspective = FLAT_PERSPECTIVE;
    let scale = 1;
    let opacity = 1;

    const c = compiled.value;
    if (c !== null) {
      const seconds = progress !== null ? progress.value * c.duration : t.value;
      livePoseAtInto(c, seconds, dir.value, 0, _pose);
      tx = _pose.tx;
      ty = _pose.ty;
      rotation = _pose.rotationDeg;
      rotateX = _pose.rotateXDeg;
      rotateY = _pose.rotateYDeg;
      if (c.uses3d && _pose.perspective > 0) perspective = _pose.perspective;
      scale = _pose.scale;
      opacity = _pose.opacity;
    }

    const pressed = pressPose.value;
    if (pressed !== null) {
      // At its duration every entry but a press is at rest, so only the press blend is left.
      livePoseAtInto(pressed, pressed.duration, 1, pressT.value, _press);
      scale *= _press.scale;
      opacity *= _press.opacity;
    }

    return {
      opacity: hidden.value === 1 ? 0 : opacity,
      transform: [
        { perspective },
        { translateX: tx },
        { translateY: ty },
        { rotateX: `${rotateX}deg` },
        { rotateY: `${rotateY}deg` },
        { rotate: `${rotation}deg` },
        { scale },
      ],
    };
  }, [progress]);

  return { driver: created.current, style };
}
