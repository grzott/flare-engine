import { createGatedProvider, type HapticsProvider } from './provider.js';

/**
 * Structural shape of the `expo-haptics` module surface this adapter needs — the
 * `impactAsync` / `notificationAsync` / `selectionAsync` async calls. Declared
 * here so the package never depends on `expo-haptics`; the app injects the real
 * module (matching the repo's adapter pattern — cf. `@flare-engine/iap-revenuecat`).
 *
 * Style / type params are `string` because expo types them as its own string
 * enums (`ImpactFeedbackStyle` / `NotificationFeedbackType`) whose VALUES equal
 * this package's `HapticImpactStyle` / `HapticNotificationType` literals
 * (`'light'`…`'rigid'`, `'success'`…`'error'`), so the cue kind forwards through
 * unchanged and the real `Haptics` module stays structurally assignable.
 */
export interface ExpoHapticsModule {
  impactAsync(style?: string): Promise<void>;
  notificationAsync(type?: string): Promise<void>;
  selectionAsync(): Promise<void>;
}

/**
 * Create a {@link HapticsProvider} backed by an injected `expo-haptics` module.
 * Maps the cue surface onto expo's calls (`impact` → `impactAsync`,
 * `notification` → `notificationAsync`, `selection` → `selectionAsync`); an
 * omitted style / type forwards `undefined`, letting expo apply its own default.
 * Starts enabled — gate it off via `setEnabled(false)` (e.g. from the
 * `@flare-engine/a11y` reduced-motion signal, or a user setting).
 *
 * @example
 * import * as Haptics from 'expo-haptics';
 * const haptics = createExpoHapticsProvider(Haptics);
 */
export function createExpoHapticsProvider(expo: ExpoHapticsModule): HapticsProvider {
  return createGatedProvider(
    {
      impact: (style) => expo.impactAsync(style),
      notification: (type) => expo.notificationAsync(type),
      selection: () => expo.selectionAsync(),
    },
    true,
  );
}
