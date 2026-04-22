import type { LocalizationManager } from '@flare-engine/localization';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type GameState, gameState, stateChanged } from '../state';

export interface HudActions {
  onRetry: () => void;
  onContinue: () => void;
}

function cloneState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}

export interface HudProps {
  localization: LocalizationManager;
  actions: HudActions;
}

export function Hud({ localization, actions }: HudProps): React.ReactElement {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => localization.t(key, params),
    [localization],
  );

  const inPlay = s.currentScene === 'play';
  const isGameOver = s.currentScene === 'game-over';
  const isVictory = s.currentScene === 'victory';

  return (
    <View pointerEvents="none" style={styles.root}>
      {inPlay ? (
        <>
          <View style={styles.topLeft}>
            <Text style={styles.score}>{t('hud.score', { score: s.score })}</Text>
            <Text style={styles.hp}>
              {t('hud.hp', { hp: Math.max(0, s.playerHp), max: s.playerHpMax })}
            </Text>
            <Text style={styles.bombs}>{t('hud.bombs_remaining', { n: s.bombCharges })}</Text>
          </View>
          {s.bossActive && s.bossHpMax > 0 ? (
            <View style={styles.bossBar}>
              <Text style={styles.bossName}>
                {t('hud.boss_name', {
                  name: t(s.bossNameKey),
                })}
              </Text>
              <View style={styles.bossBarBg}>
                <View
                  style={[
                    styles.bossBarFill,
                    {
                      width: `${Math.max(0, Math.min(1, s.bossHp / s.bossHpMax)) * 100}%`,
                    },
                  ]}
                />
              </View>
              {s.bossShieldActive ? (
                <Text style={styles.shieldActive}>{t('hud.shield_active')}</Text>
              ) : null}
            </View>
          ) : null}
          {s.minibossActive && s.minibossHpMax > 0 && !s.bossActive ? (
            <View style={styles.minibossBar}>
              <Text style={styles.minibossName}>
                {t('hud.miniboss_name', {
                  name: t(s.minibossNameKey),
                })}
              </Text>
              <View style={styles.minibossBarBg}>
                <View
                  style={[
                    styles.minibossBarFill,
                    {
                      width: `${Math.max(0, Math.min(1, s.minibossHp / s.minibossHpMax)) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
          {s.zoneBanner.visible && s.zoneBanner.opacity > 0.01 ? (
            <View
              style={[styles.zoneBanner, { opacity: s.zoneBanner.opacity }]}
              pointerEvents="none"
            >
              <Text style={styles.zoneBannerTitle}>{t(s.zoneBanner.nameKey)}</Text>
              <Text style={styles.zoneBannerSub}>{t(s.zoneBanner.subtitleKey)}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {isGameOver ? (
        <Pressable style={styles.centerOverlay} onPress={actions.onRetry}>
          <Text style={styles.bannerTitle}>{t('menu.game_over.title')}</Text>
          <Text style={styles.bannerSub}>{t('hud.score', { score: s.score })}</Text>
          <Text style={styles.tapHint}>{t('menu.tap_retry')}</Text>
        </Pressable>
      ) : null}

      {isVictory ? (
        <Pressable style={styles.centerOverlay} onPress={actions.onContinue}>
          <Text style={styles.bannerTitle}>{t('menu.victory.title')}</Text>
          <Text style={styles.bannerSub}>{t('hud.score', { score: s.score })}</Text>
          <Text style={styles.tapHint}>{t('menu.tap_continue')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  topLeft: { position: 'absolute', top: 32, left: 16 },
  score: { color: '#F3C262', fontSize: 20, fontWeight: '700' },
  hp: { color: '#fff', fontSize: 14, marginTop: 4 },
  bombs: { color: '#fff', fontSize: 14, marginTop: 2 },
  bossBar: {
    position: 'absolute',
    top: 32,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bossName: {
    color: '#C0392B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  bossBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bossBarFill: { height: '100%', backgroundColor: '#C0392B' },
  minibossBar: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  minibossName: {
    color: '#E67E22',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  minibossBarBg: {
    width: '70%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  minibossBarFill: { height: '100%', backgroundColor: '#E67E22' },
  zoneBanner: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoneBannerTitle: {
    color: '#F3C262',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  zoneBannerSub: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 1,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bannerTitle: {
    color: '#F3C262',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  bannerSub: { color: '#fff', fontSize: 18, marginTop: 12 },
  tapHint: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 24 },
  shieldActive: {
    color: '#5BCFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
  },
});
