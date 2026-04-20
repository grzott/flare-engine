import {
  Button,
  FocusProvider,
  HUDBar,
  Label,
  Modal,
  ThemeProvider,
  darkTheme,
} from '@flare-engine/ui';
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { toggleShowFps } from './fps-state';
import { menuActions } from './menu-actions';
import { useFpsLine, useShowFps } from './use-fps-state';
import { useGameState } from './use-game-state';

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
  const fpsLine = useFpsLine();
  const showFps = useShowFps();
  const flashAlpha = s.bombFlashAlpha;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {flashAlpha > 0 ? (
        <View pointerEvents="none" style={[styles.flash, { opacity: flashAlpha }]} />
      ) : null}

      <View style={styles.topRow} pointerEvents="none">
        <Label variant="lg" style={styles.score}>
          {`SCORE ${s.score.toString().padStart(6, '0')}`}
        </Label>
        <Label variant="lg" tone="warning" style={styles.bombs}>
          {`BOMB x${s.bombCharges}`}
        </Label>
      </View>

      <Pressable
        onLongPress={toggleShowFps}
        delayLongPress={400}
        style={styles.fpsHotspot}
        accessibilityLabel="Toggle FPS overlay"
      >
        {showFps && fpsLine ? (
          <Label variant="xs" tone="success" mono>
            {fpsLine}
          </Label>
        ) : null}
      </Pressable>

      {s.bossActive ? (
        <View style={styles.bossWrap} pointerEvents="none">
          <HUDBar label="BOSS" kind="hp" value={s.bossHp} max={s.bossHpMax} showNumbers={false} />
        </View>
      ) : null}

      <View style={styles.hpWrap} pointerEvents="none">
        <HUDBar label="HP" kind="hp" value={s.playerHp} max={s.playerHpMax} showNumbers={false} />
      </View>

      <Modal visible={s.currentScene === 'menu' && s.menuReady}>
        <Pressable onPress={menuActions.onTitleTap} style={styles.titleHit}>
          <Label variant="xl" style={styles.title}>
            FLARE SHMUP
          </Label>
        </Pressable>
        <View style={styles.modalButtons}>
          <Button label="START" variant="primary" onPress={menuActions.onStart} />
        </View>
      </Modal>

      <Modal visible={s.currentScene === 'game-over' && s.menuReady}>
        <Label variant="xl" style={styles.title}>
          GAME OVER
        </Label>
        <Label variant="sm" tone="muted" style={styles.subtitle}>
          {`SCORE ${s.score}`}
        </Label>
        <View style={styles.modalButtons}>
          <Button label="CONTINUE" variant="primary" onPress={menuActions.onContinue} />
        </View>
      </Modal>

      <Modal visible={s.currentScene === 'victory' && s.menuReady}>
        <Label variant="xl" tone="success" style={styles.title}>
          VICTORY
        </Label>
        <Label variant="sm" tone="muted" style={styles.subtitle}>
          {`SCORE ${s.score}`}
        </Label>
        <View style={styles.modalButtons}>
          <Button label="CONTINUE" variant="primary" onPress={menuActions.onContinue} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
  },
  topRow: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  score: { letterSpacing: 2, fontWeight: '700' },
  bombs: { letterSpacing: 2, fontWeight: '700' },
  fpsHotspot: {
    position: 'absolute',
    top: 52,
    right: 12,
    minWidth: 48,
    minHeight: 28,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'flex-end',
  },
  bossWrap: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
  },
  hpWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  title: { letterSpacing: 4, fontWeight: '800', textAlign: 'center' },
  subtitle: { letterSpacing: 2, marginTop: 8, textAlign: 'center' },
  titleHit: { paddingVertical: 8 },
  modalButtons: { marginTop: 20, alignItems: 'stretch' },
});
