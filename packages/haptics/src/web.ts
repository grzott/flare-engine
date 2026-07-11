import {
  createGatedProvider,
  type HapticImpactStyle,
  type HapticNotificationType,
  type HapticsProvider,
  NoopHapticsProvider,
} from './provider.js';

/** Structural shape of `navigator.vibrate`: buzz for `ms`, or run an on/off pattern; returns whether it fired. */
export type WebVibrate = (pattern: number | number[]) => boolean;

/** Impact cue durations (ms), keyed by intensity — heavier styles buzz longer. */
const IMPACT_MS: Record<HapticImpactStyle, number> = {
  light: 10,
  medium: 20,
  heavy: 40,
  soft: 15,
  rigid: 30,
};

/** Notification cue patterns (ms on/off/on…), one distinct pulse per category. */
const NOTIFICATION_PATTERN: Record<HapticNotificationType, number[]> = {
  success: [10, 40, 20],
  warning: [20, 60, 20],
  error: [30, 40, 30, 40, 30],
};

/** Selection tick duration (ms) — a single light buzz. */
const SELECTION_MS = 5;

const DEFAULT_IMPACT: HapticImpactStyle = 'medium';
const DEFAULT_NOTIFICATION: HapticNotificationType = 'success';

/**
 * Create a {@link HapticsProvider} backed by the Web Vibration API. Pass
 * `navigator.vibrate` bound to `navigator` (e.g.
 * `navigator.vibrate?.bind(navigator)`).
 *
 * When `vibrate` is absent — the API is unsupported on iOS Safari and most
 * desktop browsers — this returns the inert {@link NoopHapticsProvider}, so
 * `isEnabled()` stays `false` and cues never fire (callers need not feature-detect,
 * and the provider never claims to be enabled when there is no backend). When
 * present, starts enabled; gate via `setEnabled`.
 *
 * Cue durations: impact scales with intensity, notification uses a distinct pulse
 * pattern per category, selection is a single short tick.
 */
export function createWebVibrationProvider(vibrate?: WebVibrate): HapticsProvider {
  if (typeof vibrate !== 'function') {
    return NoopHapticsProvider;
  }
  const buzz = vibrate;
  return createGatedProvider(
    {
      async impact(style): Promise<void> {
        buzz(IMPACT_MS[style ?? DEFAULT_IMPACT]);
      },
      async notification(type): Promise<void> {
        buzz(NOTIFICATION_PATTERN[type ?? DEFAULT_NOTIFICATION]);
      },
      async selection(): Promise<void> {
        buzz(SELECTION_MS);
      },
    },
    true,
  );
}
