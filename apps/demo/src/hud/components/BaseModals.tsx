import { Button, Label, Modal } from '@flare-engine/ui';
import type React from 'react';
import { View } from 'react-native';
import type { GameState } from '../../state';
import { tileTitle } from '../helpers';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';
import type { UiState } from '../ui-state';
import { LeaderboardBody } from './atoms';

/** Base hub: SHOP/INVENTORY/SHIPS/SCORES tiles + LAUNCH RUN / SETTINGS / MAIN MENU.
 *  NOT memo'd — singleton-prop refs never change, so memo would skip updates. */
export function BaseMenuModal(props: {
  state: GameState;
  ui: UiState;
}): React.ReactElement {
  const { state: s, ui } = props;
  const visible =
    s.currentScene === 'base' && s.menuReady && !ui.settingsOpen && ui.baseTile === null;
  return (
    <Modal visible={visible}>
      <Label variant="xl" style={styles.title}>
        HOME BASE
      </Label>
      <Label variant="sm" tone="muted" style={styles.subtitle}>
        {`SLOT ${(s.activeSlot ?? 0) + 1} · BEST ${s.slots[s.activeSlot ?? 0]?.bestScore ?? 0}`}
      </Label>
      <View style={styles.grid}>
        {/* TODO(post-launch): shop / inventory / ships tiles are placeholder stubs — gameplay wiring deferred. */}
        <View style={styles.gridRow}>
          <View style={styles.gridCell}>
            <Button
              label="SHOP"
              variant="secondary"
              onPress={() => menuActions.onOpenBaseTile('shop')}
            />
          </View>
          <View style={styles.gridCell}>
            <Button
              label="INVENTORY"
              variant="secondary"
              onPress={() => menuActions.onOpenBaseTile('inventory')}
            />
          </View>
        </View>
        <View style={styles.gridRow}>
          <View style={styles.gridCell}>
            <Button
              label="SHIPS"
              variant="secondary"
              onPress={() => menuActions.onOpenBaseTile('ships')}
            />
          </View>
          <View style={styles.gridCell}>
            <Button
              label="SCORES"
              variant="secondary"
              onPress={() => menuActions.onOpenBaseTile('leaderboard')}
            />
          </View>
        </View>
      </View>
      <View style={styles.modalButtons}>
        <Button label="LAUNCH RUN" variant="primary" onPress={menuActions.onLaunchRun} />
        <Button label="SETTINGS" variant="ghost" onPress={menuActions.onOpenSettings} />
        <Button label="MAIN MENU" variant="ghost" onPress={menuActions.onBaseBack} />
      </View>
    </Modal>
  );
}

/** A single base-hub tile's detail modal. SCORES shows the leaderboard;
 *  other tiles show a placeholder "coming soon" message. */
export function BaseTileModal(props: {
  state: GameState;
  ui: UiState;
}): React.ReactElement {
  const { state: s, ui } = props;
  return (
    <Modal visible={s.currentScene === 'base' && ui.baseTile !== null}>
      <Label variant="xl" style={styles.title}>
        {tileTitle(ui.baseTile)}
      </Label>
      {ui.baseTile === 'leaderboard' ? (
        <LeaderboardBody slots={s.slots} />
      ) : (
        <Label variant="sm" tone="muted" style={styles.subtitle}>
          Coming soon. This tile is a placeholder in the engine demo.
        </Label>
      )}
      <View style={styles.modalButtons}>
        <Button label="CLOSE" variant="primary" onPress={menuActions.onCloseBaseTile} />
      </View>
    </Modal>
  );
}
