import { Button, Label, Modal } from '@flare-engine/ui';
import React from 'react';
import { View } from 'react-native';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';

/** Pause modal shown during play. */
export const PauseModal = React.memo(function PauseModal(props: {
  visible: boolean;
}): React.ReactElement {
  return (
    <Modal visible={props.visible}>
      <Label variant="xl" style={styles.title}>
        PAUSED
      </Label>
      <View style={styles.modalButtons}>
        <Button label="RESUME" variant="primary" onPress={menuActions.onPauseResume} />
        <Button label="SETTINGS" variant="ghost" onPress={menuActions.onOpenSettings} />
        <Button label="MAIN MENU" variant="ghost" onPress={menuActions.onPauseToMenu} />
      </View>
    </Modal>
  );
});
