import type { LocalizationManager } from '@flare-engine/localization';
import { ProgressBar, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type BootProgress, type GameState, gameState, stateChanged } from '../state';
import { rawStyles } from './BootOverlay.styles';

const styles = StyleSheet.create(rawStyles);

export interface BootOverlayProps {
  localization: LocalizationManager;
}

function cloneRelevant(): { currentScene: GameState['currentScene']; bootProgress: BootProgress } {
  return {
    currentScene: gameState.currentScene,
    bootProgress: { ...gameState.bootProgress },
  };
}

export function BootOverlay({ localization }: BootOverlayProps): React.ReactElement | null {
  const [s, setS] = useState(() => cloneRelevant());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneRelevant()));
    return () => off();
  }, []);

  if (s.currentScene !== 'boot') return null;

  return (
    <ThemeProvider theme={darkTheme}>
      <View style={styles.root}>
        <Text style={styles.label}>{localization.t(s.bootProgress.labelKey)}</Text>
        <Text style={styles.subLabel}>{localization.t('boot.loading')}</Text>
        <ProgressBar value={s.bootProgress.value} style={styles.bar} />
      </View>
    </ThemeProvider>
  );
}
