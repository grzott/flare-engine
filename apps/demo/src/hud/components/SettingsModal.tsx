import { Button, Label, Modal } from '@flare-engine/ui';
import type React from 'react';
import { View } from 'react-native';
import type { GameState } from '../../state';
import { settingsPatch } from '../helpers';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';
import { SettingRow, ToggleRow } from './atoms';

/** Settings modal: SFX / MUSIC / SCREEN SHAKE.
 *  NOT memo'd — `state` is the mutable `gameState` singleton. */
export function SettingsModal(props: {
  state: GameState;
  visible: boolean;
}): React.ReactElement {
  const s = props.state;
  return (
    <Modal visible={props.visible}>
      <Label variant="xl" style={styles.title}>
        SETTINGS
      </Label>
      <View style={styles.settingsCol}>
        <SettingRow
          label="SFX"
          value={s.settings.sfxVolume}
          onChange={(v) => settingsPatch({ sfxVolume: v })}
        />
        <SettingRow
          label="MUSIC"
          value={s.settings.musicVolume}
          onChange={(v) => settingsPatch({ musicVolume: v })}
        />
        <ToggleRow
          label="SCREEN SHAKE"
          value={s.settings.screenShake}
          onToggle={() => settingsPatch({ screenShake: !s.settings.screenShake })}
        />
      </View>
      <View style={styles.modalButtons}>
        <Button label="CLOSE" variant="primary" onPress={menuActions.onCloseSettings} />
      </View>
    </Modal>
  );
}
