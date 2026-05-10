import type { LocalizationManager } from '@flare-engine/localization';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rawStyles } from './PauseOverlay.styles';

export interface PauseOverlayActions {
  onResume: () => void;
  onSettings?: () => void;
  onQuit: () => void;
}

export interface PauseOverlayProps {
  localization: LocalizationManager;
  actions: PauseOverlayActions;
}

export function PauseOverlay({ localization, actions }: PauseOverlayProps): React.ReactElement {
  const t = (key: string): string => localization.t(key);
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Pressable style={styles.closeBtn} onPress={actions.onResume} accessibilityRole="button">
          <Text style={styles.closeBtnLabel}>{'×'}</Text>
        </Pressable>
        <Text style={styles.title}>{t('menu.pause.title')}</Text>
        <Pressable style={styles.btnPrimary} onPress={actions.onResume} accessibilityRole="button">
          <Text style={styles.btnPrimaryLabel}>{t('menu.pause.resume')}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={actions.onSettings} accessibilityRole="button">
          <Text style={styles.btnLabel}>{t('menu.pause.settings')}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={actions.onQuit} accessibilityRole="button">
          <Text style={styles.btnLabel}>{t('menu.pause.quit')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(rawStyles);
