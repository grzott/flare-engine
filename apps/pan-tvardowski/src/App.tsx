import type React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppRoot } from './AppRoot';
import { markBootStart } from './perf/cold-start';

// markBootStart() runs in the module body — AFTER the AppRoot import graph has
// evaluated — to preserve the original cold-start T0 capture point (the former
// single-file App.tsx called it after all imports). Do not hoist this into a
// leading side-effect import: that moves T0 ahead of the module-graph eval and
// changes the measured cold-start window.
markBootStart();

// Suppress the expo-keep-awake auto-activation on Android so the screen
// obeys the OS setting during menus and cutscenes. Wrapped in try/catch
// because the module may be absent in test / web environments.
if (Platform.OS === 'android') {
  try {
    const { deactivateKeepAwake } = require('expo-keep-awake') as {
      deactivateKeepAwake: () => void;
    };
    deactivateKeepAwake();
  } catch {
    // no-op — module absent
  }
}

export function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}
