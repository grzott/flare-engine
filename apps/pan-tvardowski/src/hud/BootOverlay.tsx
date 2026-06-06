import type { LocalizationManager } from '@flare-engine/localization';
import { ProgressBar } from '@flare-engine/ui';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { sigilOpacity } from '../a11y/reduced-motion';
import { type BootProgress, type GameState, gameState } from '../state';
import { rawStyles } from './BootOverlay.styles';
import { HudPanelScaffold } from './HudPanelScaffold';
import { useHudState } from './useHudState';

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
  const s = useHudState(cloneRelevant);

  if (s.currentScene !== 'boot') return null;

  const opacity = sigilOpacity(s.reducedMotion);

  return (
    <HudPanelScaffold focus={false}>
      <View style={styles.root}>
        <View style={[styles.sigil, { opacity }]} />
        <Text style={styles.label}>{localization.t(s.bootProgress.labelKey)}</Text>
        <ProgressBar value={s.bootProgress.value} style={styles.bar} />
        {appVersion !== undefined ? (
          <Text style={styles.versionLabel}>{localization.t('boot.version')}</Text>
        ) : null}
      </View>
    </HudPanelScaffold>
  );
}
