import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { CreditsView } from './CreditsView';
import { HudPanelScaffold } from './HudPanelScaffold';
import { rawStyles } from './MenuOverlay.styles';
import type { MenuOverlayProps } from './MenuOverlay.types';
import { MenuView } from './MenuView';
import { SaveSelectView } from './SaveSelectView';
import { SettingsView } from './SettingsView';
import { cloneGameState, useHudState } from './useHudState';

export type { MenuOverlayActions, MenuOverlayProps } from './MenuOverlay.types';

export function MenuOverlay(props: MenuOverlayProps): React.ReactElement | null {
  const s = useHudState(cloneGameState);

  const scene = s.currentScene;
  const show =
    scene === 'menu' || scene === 'save-select' || scene === 'settings' || scene === 'credits';
  if (!show) return null;

  return (
    <View style={styles.root}>
      <HudPanelScaffold>
        {scene === 'menu' ? <MenuView {...props} /> : null}
        {scene === 'save-select' ? <SaveSelectView {...props} /> : null}
        {scene === 'settings' ? <SettingsView {...props} settings={s.settings} /> : null}
        {scene === 'credits' ? <CreditsView {...props} /> : null}
      </HudPanelScaffold>
    </View>
  );
}

export { rawStyles } from './MenuOverlay.styles';

const styles = StyleSheet.create(rawStyles);
