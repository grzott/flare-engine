import { Button, Label, Modal } from '@flare-engine/ui';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { GameState } from '../../state';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';
import type { UiState } from '../ui-state';
import { SlotRow } from './atoms';

/** Main-menu modal: NEW GAME / CONTINUE / SETTINGS. Title taps forward to
 *  `menuActions.onTitleTap` (used for the triple-tap bench easter egg). */
export const MainMenuModal = React.memo(function MainMenuModal(props: {
  state: GameState;
  ui: UiState;
}): React.ReactElement {
  const { state: s, ui } = props;
  const visible =
    s.currentScene === 'menu' && s.menuReady && !ui.settingsOpen && !ui.slotPickerOpen;
  return (
    <Modal visible={visible}>
      <Pressable onPress={menuActions.onTitleTap} style={styles.titleHit}>
        <Label variant="xl" style={styles.title}>
          FLARE SHMUP
        </Label>
      </Pressable>
      <View style={styles.modalButtons}>
        <Button label="NEW GAME" variant="primary" onPress={menuActions.onNewGame} />
        {s.lastSlotIndex !== null && s.slots[s.lastSlotIndex] ? (
          <Button
            label={`CONTINUE — SLOT ${s.lastSlotIndex + 1}`}
            variant="secondary"
            onPress={menuActions.onContinue}
          />
        ) : null}
        <Button label="SETTINGS" variant="ghost" onPress={menuActions.onOpenSettings} />
      </View>
    </Modal>
  );
});

/** Slot picker: lists 3 slots with RESET-with-confirm. */
export const SlotPickerModal = React.memo(function SlotPickerModal(props: {
  state: GameState;
  ui: UiState;
}): React.ReactElement {
  const { state: s, ui } = props;
  return (
    <Modal visible={s.currentScene === 'menu' && ui.slotPickerOpen}>
      <Label variant="xl" style={styles.title}>
        PICK A SLOT
      </Label>
      <View style={styles.modalButtons}>
        {[0, 1, 2].map((i) => (
          <SlotRow
            key={i}
            index={i}
            slot={s.slots[i] ?? null}
            pending={ui.pendingResetSlot === i}
          />
        ))}
        <Button label="BACK" variant="ghost" onPress={menuActions.onCloseSettings} />
      </View>
    </Modal>
  );
});
