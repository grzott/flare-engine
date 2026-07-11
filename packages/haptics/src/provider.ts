/** iOS `UIFeedbackGenerator`-style impact intensities; adapters map to platform APIs. */
export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

/** Notification feedback categories. */
export type HapticNotificationType = 'success' | 'warning' | 'error';

/**
 * Haptics (tactile feedback) provider interface. Consumers supply a concrete
 * adapter (Expo Haptics, the Web Vibration API, a Core Haptics bridge) at the app
 * boundary. The cue surface is deliberately thin — three semantic calls mirroring
 * the iOS `UIFeedbackGenerator` family so any platform SDK can back it — plus an
 * enabled gate, so the user's haptics setting and the reduced-motion gate
 * (`@flare-engine/a11y`) live in one place instead of at every call site.
 */
export interface HapticsProvider {
  /** A physical impact cue — weapon fire, projectile hit, bomb detonation. */
  impact(style?: HapticImpactStyle): Promise<void>;
  /** A notification cue — victory, medal earned, error / deny. */
  notification(type?: HapticNotificationType): Promise<void>;
  /** A light selection tick — menu focus, toggle, pickup. */
  selection(): Promise<void>;
  /**
   * Whether cues currently fire. Reflects the user setting and the reduced-motion
   * gate; when `false`, `impact` / `notification` / `selection` are no-ops.
   */
  isEnabled(): boolean;
  /** Enable or disable all feedback. When disabled, cue methods resolve without firing. */
  setEnabled(enabled: boolean): void;
}

/**
 * The three cue implementations a concrete backend supplies. {@link createGatedProvider}
 * wraps them with the shared enabled gate so every provider honours the enabled
 * setting identically, and a backend never has to re-implement the gate.
 */
export interface HapticCues {
  impact(style?: HapticImpactStyle): Promise<void>;
  notification(type?: HapticNotificationType): Promise<void>;
  selection(): Promise<void>;
}

/**
 * Wrap cue implementations with a real enabled gate. When disabled, cue methods
 * resolve without invoking the backend; `setEnabled` / `isEnabled` reflect the
 * live state (held in this closure, so each call is an independent instance) so a
 * consumer's haptics toggle is observable — and unit-testable. Not part of the
 * public barrel; the shipped providers (expo / web / noop factory) build on it.
 */
export function createGatedProvider(cues: HapticCues, initialEnabled: boolean): HapticsProvider {
  let enabled = initialEnabled;
  return {
    async impact(style?: HapticImpactStyle): Promise<void> {
      if (enabled) await cues.impact(style);
    },
    async notification(type?: HapticNotificationType): Promise<void> {
      if (enabled) await cues.notification(type);
    },
    async selection(): Promise<void> {
      if (enabled) await cues.selection();
    },
    isEnabled(): boolean {
      return enabled;
    },
    setEnabled(next: boolean): void {
      enabled = next;
    },
  };
}

/** Stateless no-op cues, shared by both no-op providers below. */
const NOOP_CUES: HapticCues = {
  async impact(): Promise<void> {
    // no-op
  },
  async notification(): Promise<void> {
    // no-op
  },
  async selection(): Promise<void> {
    // no-op
  },
};

/**
 * Immutable no-op provider. Reports disabled and fires nothing — the safe default
 * where there is no haptics backend (web without vibration, CI, tests) and the
 * default value of `HapticsContext`. `setEnabled` is inert BY DESIGN: this is the
 * hard "off" default, so wiring it into a context can never accidentally report
 * "enabled". For a no-op whose enabled toggle is observable (e.g. to unit-test a
 * consumer's haptics setting), use {@link createNoopHapticsProvider}.
 */
export const NoopHapticsProvider: HapticsProvider = {
  ...NOOP_CUES,
  isEnabled(): boolean {
    return false;
  },
  setEnabled(): void {
    // inert: hard "off" default — see createNoopHapticsProvider for a toggle-able one
  },
};

/**
 * Create a stateful no-op provider: cue methods never fire, but `setEnabled` /
 * `isEnabled` track real state. Use it to unit-test a consumer's haptics toggle
 * without a native backend. Each call is an independent instance; defaults to
 * disabled (matching {@link NoopHapticsProvider}).
 */
export function createNoopHapticsProvider(initialEnabled = false): HapticsProvider {
  return createGatedProvider(NOOP_CUES, initialEnabled);
}
