/** One `Element.animate` call, and the `Animation` it returned. */
export interface FakeAnimation {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  currentTime: number | null;
  playbackRate: number;
  finished: Promise<void>;
  /** Every `cancel`, `reverse` and `pause` call, in order. */
  calls: ('cancel' | 'reverse' | 'pause')[];
  cancel(): void;
  reverse(): void;
  pause(): void;
  /** The animation ran to its end: resolves `finished`. */
  finish(): void;
}

/** What the tests drive and read. */
export const waapi = {
  /** Every animation made, oldest first. */
  animations: [] as FakeAnimation[],
  /** The animations on `el` that were never cancelled, oldest first. */
  liveOn(el: Element | null): FakeAnimation[] {
    return waapi.animations.filter((a) => a.target === el && !a.calls.includes('cancel'));
  },
  reset(): void {
    waapi.animations = [];
  },
};

function createAnimation(
  target: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): FakeAnimation {
  let resolve: () => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const finished = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // As in a browser: the promise an `Animation.cancel()` rejects is marked as handled.
  finished.catch(() => {});
  const animation: FakeAnimation = {
    target,
    keyframes,
    options,
    currentTime: 0,
    playbackRate: 1,
    finished,
    calls: [],
    cancel() {
      animation.calls.push('cancel');
      animation.currentTime = null;
      reject(new Error('AbortError'));
    },
    reverse() {
      animation.calls.push('reverse');
      animation.playbackRate = -animation.playbackRate;
    },
    pause() {
      animation.calls.push('pause');
    },
    finish() {
      animation.currentTime = typeof options.duration === 'number' ? options.duration : 0;
      resolve();
    },
  };
  return animation;
}

/**
 * Replaces `Element.prototype.animate` with one that records its calls and never moves on its
 * own. Call it after `installDom()`.
 */
export const installFakeAnimate = (): typeof waapi => {
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ): Animation {
    if (!Array.isArray(keyframes)) throw new Error('fake-animate: expected an array of keyframes');
    if (typeof options !== 'object') throw new Error('fake-animate: expected an options object');
    const animation = createAnimation(this, keyframes, options);
    waapi.animations.push(animation);
    return animation as unknown as Animation;
  };
  return waapi;
};
