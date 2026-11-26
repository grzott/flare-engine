import { Platform } from 'react-native';

declare const process: { env: { NODE_ENV?: string } } | undefined;

/** The Expo module in `android/`. Both calls answer on the main thread, so both return promises. */
interface DisplayModeModule {
  setFastest(): unknown;
  clear(): unknown;
}

const MODULE_NAME = 'FlareUiFxDisplayMode';

let holders = 0;
let held: DisplayModeModule | null = null;
let warnedMissing = false;

const release = (): void => {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Read from the global Expo installs its modules on, not through an import of
// `expo-modules-core`: that peer is optional, and Metro cannot resolve an import of a package
// that is not installed.
function findModule(): DisplayModeModule | null {
  const expo: unknown = Reflect.get(globalThis, 'expo');
  if (!isRecord(expo) || !isRecord(expo.modules)) return null;
  const found = expo.modules[MODULE_NAME];
  if (!isRecord(found)) return null;
  const { setFastest, clear } = found;
  if (typeof setFastest !== 'function' || typeof clear !== 'function') return null;
  return {
    setFastest: () => setFastest.call(found),
    clear: () => clear.call(found),
  };
}

function warnMissing(): void {
  if (warnedMissing) return;
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
  warnedMissing = true;
  console.warn(
    'ui-fx: the display-mode module is not in this build (no Expo modules, or Expo Go), so ' +
      'snapshot effects may run at 30–60 Hz on Android 15 and later.',
  );
}

const ignore = (): void => {};

// The window may be gone (no current activity). An effect still plays, at the rate the OS picks.
function call(request: () => unknown): void {
  try {
    const answer = request();
    if (answer instanceof Promise) answer.catch(ignore);
  } catch {}
}

/**
 * Ask Android for the panel's fastest display mode until the returned function is called (C39).
 * On Android 15 and later the OS picks the render rate, and an overlay that moves only Skia
 * content is given 30–60 Hz.
 *
 * Reference-counted: the first acquire sets the window's `preferredDisplayModeId`, the last
 * release clears it. A release counts once, however often it is called.
 *
 * A no-op on iOS and the web, and in an Android build without the module, where it warns once in
 * development.
 */
export function acquireFastDisplayMode(): () => void {
  if (Platform.OS !== 'android') return release;
  if (holders === 0) {
    held = findModule();
    if (held === null) warnMissing();
    else call(held.setFastest);
  }
  holders++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    if (holders > 0 || held === null) return;
    call(held.clear);
    held = null;
  };
}
