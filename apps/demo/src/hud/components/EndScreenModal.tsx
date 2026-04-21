import { Button, Label, Modal } from '@flare-engine/ui';
import type React from 'react';
import { View } from 'react-native';
import type { GameState } from '../../state';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';
import { EndSummary } from './atoms';

/** Victory / Game-Over end-of-run screen. Uses the same modal, swapping title
 *  tone and action labels based on `currentScene`.
 *  NOT memo'd — `state` is the mutable `gameState` singleton. */
export function EndScreenModal(props: {
  state: GameState;
  visible: boolean;
}): React.ReactElement {
  const s = props.state;
  const isVictory = s.currentScene === 'victory';
  return (
    <Modal visible={props.visible}>
      <Label variant="xl" tone={isVictory ? 'success' : 'danger'} style={styles.title}>
        {isVictory ? 'VICTORY' : 'GAME OVER'}
      </Label>
      <EndSummary
        run={s.runStats}
        slot={s.activeSlot !== null ? (s.slots[s.activeSlot] ?? null) : null}
      />
      <View style={styles.modalButtons}>
        {s.currentScene === 'game-over' ? (
          <Button label="RETRY" variant="primary" onPress={menuActions.onEndRetry} />
        ) : null}
        <Button
          label={isVictory ? 'CONTINUE' : 'BACK TO BASE'}
          variant={isVictory ? 'primary' : 'secondary'}
          onPress={menuActions.onEndContinue}
        />
      </View>
    </Modal>
  );
}
