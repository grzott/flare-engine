import { FocusProvider, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { View } from 'react-native';
import { BaseMenuModal, BaseTileModal } from './components/BaseModals';
import { DialogueOverlay } from './components/DialogueOverlay';
import { EndScreenModal } from './components/EndScreenModal';
import { FpsOverlay } from './components/FpsOverlay';
import { HudPlayLayer } from './components/HudPlayLayer';
import { MainMenuModal, SlotPickerModal } from './components/MenuModals';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { styles } from './styles';
import { useGameState } from './use-game-state';
import { useUiState } from './use-ui-state';

/** Root HUD component. Dispatches to per-scene layers / modals based on
 *  `gameState.currentScene` + `uiState` flags. All branches render from the
 *  same two state reads so scene transitions stay coherent. */
export function Hud(): React.ReactElement {
  return (
    <ThemeProvider theme={darkTheme}>
      <FocusProvider>
        <HudInner />
      </FocusProvider>
    </ThemeProvider>
  );
}

function HudInner(): React.ReactElement {
  const s = useGameState();
  const ui = useUiState();
  const inPlay = s.currentScene === 'play';
  const isEnd = s.currentScene === 'game-over' || s.currentScene === 'victory';
  const flashAlpha = s.bombFlashAlpha;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {flashAlpha > 0 ? (
        <View pointerEvents="none" style={[styles.flash, { opacity: flashAlpha }]} />
      ) : null}

      {inPlay ? <HudPlayLayer state={s} /> : null}

      <FpsOverlay />

      <MainMenuModal state={s} ui={ui} />
      <SlotPickerModal state={s} ui={ui} />
      <SettingsModal state={s} visible={ui.settingsOpen} />
      <BaseMenuModal state={s} ui={ui} />
      <BaseTileModal state={s} ui={ui} />
      <DialogueOverlay active={s.currentScene === 'dialogue'} />
      <PauseModal visible={inPlay && ui.pauseOpen && !ui.settingsOpen} />
      <EndScreenModal state={s} visible={isEnd && s.menuReady && !ui.settingsOpen} />
    </View>
  );
}
