import type { LocalizationManager } from '@flare-engine/localization';
import { ProgressBar, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { sigilOpacity } from '../a11y/reduced-motion';
import { type BootProgress, type GameState, gameState, stateChanged } from '../state';
import { rawStyles } from './BootOverlay.styles';

const styles = StyleSheet.create(rawStyles);

export interface BootOverlayProps {
  localization: LocalizationManager;
  appVersion?: string;
}

function cloneRelevant(): {
  currentScene: GameState['currentScene'];
  bootProgress: BootProgress;
  reducedMotion: boolean;
} {
  return {
    currentScene: gameState.currentScene,
    bootProgress: { ...gameState.bootProgress },
    reducedMotion: gameState.settings.reducedMotion,
  };
}

export function BootOverlay({
  localization,
  appVersion,
}: BootOverlayProps): React.ReactElement | null {
  const [s, setS] = useState(() => cloneRelevant());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneRelevant()));
    return () => off();
  }, []);

  if (s.currentScene !== 'boot') return null;

  const opacity = sigilOpacity(s.reducedMotion);

  return (
    <ThemeProvider theme={darkTheme}>
      <View style={styles.root}>
        <View style={[styles.sigil, { opacity }]} />
        <Text style={styles.label}>{localization.t(s.bootProgress.labelKey)}</Text>
        <ProgressBar value={s.bootProgress.value} style={styles.bar} />
        {appVersion !== undefined ? (
          <Text style={styles.versionLabel}>{localization.t('boot.version')}</Text>
        ) : null}
      </View>
    </ThemeProvider>
  );
}
