import type { LocalizationManager } from '@flare-engine/localization';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type GameState, gameState, stateChanged } from '../state';

export interface HudActions {
  onRetry: () => void;
  onContinue: () => void;
  onShare: () => void;
}

/** Minimal structural shape of safe-area insets. Kept local so tests and
 *  typecheck don't need to resolve `react-native-safe-area-context`. */
export interface HudInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
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
  /** Safe-area insets from the hosting `<SafeAreaProvider>`. Optional so
   *  the HUD can still render in tests that don't install the provider. */
  insets?: HudInsets;
}

export function Hud({ localization, actions, insets }: HudProps): React.ReactElement {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => localization.t(key, params),
    [localization],
  );

  const topInset = insets?.top ?? 0;
  const horizontalInsetLeft = insets?.left ?? 0;
  const horizontalInsetRight = insets?.right ?? 0;
  const topLeftStyle = useMemo(
    () => [styles.topLeft, { top: 32 + topInset, left: 16 + horizontalInsetLeft }],
    [topInset, horizontalInsetLeft],
  );
  const bossBarStyle = useMemo(
    () => [
      styles.bossBar,
      {
        top: 32 + topInset,
        left: 16 + horizontalInsetLeft,
        right: 16 + horizontalInsetRight,
      },
    ],
    [topInset, horizontalInsetLeft, horizontalInsetRight],
  );
  const minibossBarStyle = useMemo(
    () => [
      styles.minibossBar,
      {
        top: 56 + topInset,
        left: 16 + horizontalInsetLeft,
        right: 16 + horizontalInsetRight,
      },
    ],
    [topInset, horizontalInsetLeft, horizontalInsetRight],
  );

  const inPlay = s.currentScene === 'play';
  const isGameOver = s.currentScene === 'game-over';
  const isVictory = s.currentScene === 'victory';

  return (
    <View pointerEvents="none" style={styles.root}>
      {inPlay ? (
        <>
          <View style={topLeftStyle}>
            <Text style={styles.score}>{t('hud.score', { score: s.score })}</Text>
            <Text style={styles.hp}>
              {t('hud.hp', { hp: Math.max(0, s.playerHp), max: s.playerHpMax })}
            </Text>
            <Text style={styles.bombs}>{t('hud.bombs_remaining', { n: s.bombCharges })}</Text>
          </View>
          {s.bossActive && s.bossHpMax > 0 ? (
            <View style={bossBarStyle}>
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
            <View style={minibossBarStyle}>
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
          <Pressable style={styles.shareBtn} onPress={actions.onShare}>
            <Text style={styles.shareBtnLabel}>{t('hud.share')}</Text>
          </Pressable>
        </Pressable>
      ) : null}

      {isVictory ? (
        <Pressable style={styles.centerOverlay} onPress={actions.onContinue}>
          <Text style={styles.bannerTitle}>{t('menu.victory.title')}</Text>
          <Text style={styles.bannerSub}>{t('hud.score', { score: s.score })}</Text>
          <Text style={styles.tapHint}>{t('menu.tap_continue')}</Text>
          <Pressable style={styles.shareBtn} onPress={actions.onShare}>
            <Text style={styles.shareBtnLabel}>{t('hud.share')}</Text>
          </Pressable>
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
  shareBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F3C262',
    borderRadius: 6,
  },
  shareBtnLabel: {
    color: '#1a0e0a',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  shieldActive: {
    color: '#5BCFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
  },
});
