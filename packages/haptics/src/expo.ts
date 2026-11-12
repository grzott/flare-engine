import {
  createGatedProvider,
  type HapticImpactStyle,
  type HapticNotificationType,
  type HapticsProvider,
} from './provider.js';

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
  /**
   * Android system haptic feedback. Optional, so a module without it still fits.
   * `type` is `string` for the same reason as above: expo types it as its
   * `AndroidHaptics` string enum, and method syntax keeps the real module
   * structurally assignable. The adapter passes that enum's values
   * (`'clock-tick'`, `'confirm'`, …).
   */
  performAndroidHapticsAsync?(type: string): Promise<void>;
}

/** Options for {@link createExpoHapticsProvider}. */
export interface ExpoHapticsOptions {
  /**
   * The running platform — pass `Platform.OS` from `react-native`. With
   * `'android'`, cues use the system haptic effects when the injected module has
   * `performAndroidHapticsAsync`. The hint is needed because expo's function
   * resolves without doing anything on other platforms, so its presence alone
   * cannot pick the route.
   */
  platform?: string;
}

const ANDROID_SELECTION = 'clock-tick';

const ANDROID_IMPACT: Readonly<Record<HapticImpactStyle, string>> = {
  light: 'keyboard-tap',
  soft: 'keyboard-tap',
  medium: 'virtual-key',
  heavy: 'long-press',
  rigid: 'long-press',
};

const ANDROID_NOTIFICATION: Readonly<Record<HapticNotificationType, string>> = {
  success: 'confirm',
  warning: 'long-press',
  error: 'reject',
};

/**
 * Create a {@link HapticsProvider} backed by an injected `expo-haptics` module.
 * Maps the cue surface onto expo's calls (`impact` → `impactAsync`,
 * `notification` → `notificationAsync`, `selection` → `selectionAsync`); an
 * omitted style / type forwards `undefined`, letting expo apply its own default.
 * Starts enabled — gate it off via `setEnabled(false)` (e.g. from the
 * `@flare-engine/a11y` reduced-motion signal, or a user setting).
 *
 * With `options.platform === 'android'` and a module that has
 * `performAndroidHapticsAsync`, cues play Android system haptic effects instead:
 * `selection` → `'clock-tick'`; `impact` `light` / `soft` → `'keyboard-tap'`,
 * `medium` (and omitted) → `'virtual-key'`, `heavy` / `rigid` → `'long-press'`;
 * `notification` `success` (and omitted) → `'confirm'`, `warning` →
 * `'long-press'`, `error` → `'reject'`. If the module rejects an effect
 * (`'confirm'` / `'reject'` need Android 11), that cue falls back to the expo
 * call above, and the provider stops trying that effect.
 *
 * @example
 * import * as Haptics from 'expo-haptics';
 * import { Platform } from 'react-native';
 * const haptics = createExpoHapticsProvider(Haptics, { platform: Platform.OS });
 */
export function createExpoHapticsProvider(
  expo: ExpoHapticsModule,
  options?: ExpoHapticsOptions,
): HapticsProvider {
  if (options?.platform !== 'android' || typeof expo.performAndroidHapticsAsync !== 'function') {
    return createGatedProvider(
      {
        impact: (style) => expo.impactAsync(style),
        notification: (type) => expo.notificationAsync(type),
        selection: () => expo.selectionAsync(),
      },
      true,
    );
  }

  const perform = expo.performAndroidHapticsAsync.bind(expo);
  const unsupported = new Set<string>();

  // Resolves `true` when the system effect played, `false` when the caller must
  // fall back. Any rejection marks the type: the module's error class is not
  // visible from here, and a type that failed once is not worth a retry per cue.
  const playSystemEffect = async (type: string): Promise<boolean> => {
    if (unsupported.has(type)) return false;
    try {
      await perform(type);
      return true;
    } catch {
      unsupported.add(type);
      return false;
    }
  };

  return createGatedProvider(
    {
      async impact(style): Promise<void> {
        if (!(await playSystemEffect(ANDROID_IMPACT[style ?? 'medium']))) {
          await expo.impactAsync(style);
        }
      },
      async notification(type): Promise<void> {
        if (!(await playSystemEffect(ANDROID_NOTIFICATION[type ?? 'success']))) {
          await expo.notificationAsync(type);
        }
      },
      async selection(): Promise<void> {
        if (!(await playSystemEffect(ANDROID_SELECTION))) await expo.selectionAsync();
      },
    },
    true,
  );
}
