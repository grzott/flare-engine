/** iOS `UIFeedbackGenerator`-style impact intensities; adapters map to platform APIs. */
export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

/** Notification feedback categories. */
export type HapticNotificationType = 'success' | 'warning' | 'error';

/**
 * Haptics (tactile feedback) provider interface. Consumers supply a concrete
 * adapter (Expo Haptics, react-native `Vibration`, a Core Haptics bridge) at the
 * app boundary. The cue surface is deliberately thin — three semantic calls
 * mirroring the iOS `UIFeedbackGenerator` family so any platform SDK can back it
 * — plus an enabled gate, so the user's haptics setting and the reduced-motion
 * gate (`@flare-engine/a11y`) live in one place instead of at every call site.
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
 * Default no-op provider. Reports disabled and fires nothing — the safe default
 * where there is no haptics backend (web, CI, tests). All cues resolve
 * immediately; `setEnabled` is inert because there is nothing to drive.
 */
export const NoopHapticsProvider: HapticsProvider = {
  async impact(): Promise<void> {
    // no-op
  },
  async notification(): Promise<void> {
    // no-op
  },
  async selection(): Promise<void> {
    // no-op
  },
  isEnabled(): boolean {
    return false;
  },
  setEnabled(): void {
    // no-op
  },
};
