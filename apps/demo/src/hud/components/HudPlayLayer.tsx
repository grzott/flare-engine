import { HUDBar, Label } from '@flare-engine/ui';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { GameState } from '../../state';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';

/** In-play HUD layer: score, bombs, pause button, boss bar, HP bar, bomb flash. */
export const HudPlayLayer = React.memo(function HudPlayLayer(props: {
  state: GameState;
}): React.ReactElement {
  const s = props.state;
  return (
    <>
      <View style={styles.topRow} pointerEvents="box-none">
        <Label variant="lg" style={styles.score}>
          {`SCORE ${s.score.toString().padStart(6, '0')}`}
        </Label>
        <Label variant="lg" tone="warning" style={styles.bombs}>
          {`BOMB x${s.bombCharges}`}
        </Label>
      </View>

      <Pressable
        accessibilityLabel="Pause"
        onPress={menuActions.onPauseOpen}
        style={styles.pauseBtn}
      >
        <Label variant="lg" tone="muted">
          ||
        </Label>
      </Pressable>

      {s.bossActive ? (
        <View style={styles.bossWrap} pointerEvents="none">
          <HUDBar label="BOSS" kind="hp" value={s.bossHp} max={s.bossHpMax} showNumbers={false} />
        </View>
      ) : null}

      <View style={styles.hpWrap} pointerEvents="none">
        <HUDBar label="HP" kind="hp" value={s.playerHp} max={s.playerHpMax} showNumbers={false} />
      </View>
    </>
  );
});
