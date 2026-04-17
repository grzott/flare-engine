import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { toggleShowFps } from './fps-state';
import { useFpsLine, useShowFps } from './use-fps-state';
import { useGameState } from './use-game-state';

export function Hud(): React.ReactElement {
  const s = useGameState();
  const fpsLine = useFpsLine();
  const showFps = useShowFps();
  const hpFrac = s.playerHpMax > 0 ? s.playerHp / s.playerHpMax : 0;
  const bossFrac = s.bossHpMax > 0 ? s.bossHp / s.bossHpMax : 0;
  const flashAlpha = s.bombFlashAlpha;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {flashAlpha > 0 ? (
        <View pointerEvents="none" style={[styles.flash, { opacity: flashAlpha }]} />
      ) : null}

      <View style={styles.topRow} pointerEvents="none">
        <Text style={styles.score}>SCORE {s.score.toString().padStart(6, '0')}</Text>
        <Text style={styles.bombs}>BOMB x{s.bombCharges}</Text>
      </View>

      <Pressable
        onLongPress={toggleShowFps}
        delayLongPress={400}
        style={styles.fpsHotspot}
        accessibilityLabel="Toggle FPS overlay"
      >
        {showFps && fpsLine ? <Text style={styles.fpsText}>{fpsLine}</Text> : null}
      </Pressable>

      {s.bossActive ? (
        <View style={styles.bossWrap} pointerEvents="none">
          <Text style={styles.bossLabel}>BOSS</Text>
          <View style={styles.bossTrack}>
            <View style={[styles.bossFill, barStyle(bossFrac)]} />
          </View>
        </View>
      ) : null}

      <View style={styles.hpWrap} pointerEvents="none">
        <View style={styles.hpTrack}>
          <View style={[styles.hpFill, barStyle(hpFrac)]} />
        </View>
        <Text style={styles.hpLabel}>HP</Text>
      </View>

      {s.currentScene === 'menu' ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.title}>FLARE SHMUP</Text>
          <Text style={styles.subtitle}>TAP TO START</Text>
        </View>
      ) : null}

      {s.currentScene === 'game-over' ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.title}>GAME OVER</Text>
          <Text style={styles.subtitle}>TAP TO CONTINUE</Text>
        </View>
      ) : null}

      {s.currentScene === 'victory' ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.title}>VICTORY</Text>
          <Text style={styles.subtitle}>TAP TO CONTINUE</Text>
        </View>
      ) : null}
    </View>
  );
}

function barStyle(frac: number): ViewStyle {
  const clamped = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  return { width: `${Math.round(clamped * 100)}%` as `${number}%` };
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
  score: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  bombs: { color: '#ffcc66', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
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
  fpsText: {
    color: '#7fffd4',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  bossWrap: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bossLabel: {
    color: '#ff6677',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 4,
  },
  bossTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bossFill: { height: '100%', backgroundColor: '#ff4466' },
  hpWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hpLabel: { color: '#ffffff', fontSize: 12, marginLeft: 8, fontWeight: '700' },
  hpTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  hpFill: { height: '100%', backgroundColor: '#66ff99' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#ffffff', fontSize: 36, fontWeight: '800', letterSpacing: 4 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 12, letterSpacing: 2 },
});
