import type { LocalizationManager } from '@flare-engine/localization';
import { Button, FocusProvider, Label, Panel, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { SaveStore } from '../save/store';
import { ACHIEVEMENT_ENTRIES, filterAchievements } from '../scenes/achievements';
import { type GameState, gameState, stateChanged } from '../state';
import { rawStyles } from './AchievementsOverlay.styles';

const styles = StyleSheet.create(rawStyles);

export interface AchievementsOverlayActions {
  goMenu(): void;
}

export interface AchievementsOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: AchievementsOverlayActions;
}

function cloneState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}

export function AchievementsOverlay(props: AchievementsOverlayProps): React.ReactElement | null {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  if (s.currentScene !== 'achievements') return null;

  return (
    <View style={styles.root}>
      <ThemeProvider theme={darkTheme}>
        <FocusProvider>
          <AchievementsView {...props} />
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}

function AchievementsView({
  localization: l,
  save,
  actions,
}: AchievementsOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);

  const { unlocked: unlockedEntries, locked: lockedEntries } = useMemo(
    () => filterAchievements(ACHIEVEMENT_ENTRIES, save.unlockedAchievements()),
    [save],
  );

  const unlockedCount = unlockedEntries.length;

  return (
    <View style={styles.panelContainer}>
      <Panel padding="lg" radius="lg" style={styles.panel}>
        <Label variant="xl" tone="accent" style={styles.title}>
          {t('achievements.title')}
        </Label>

        <Label variant="sm" tone="muted" style={styles.subheader}>
          {`${unlockedCount} / ${ACHIEVEMENT_ENTRIES.length}`}
        </Label>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {unlockedCount === 0 ? (
            <View style={styles.entryRow}>
              <Label variant="sm" tone="accent">
                {t('achievements.fresh_save.heading')}
              </Label>
              <Label variant="xs" tone="muted">
                {t('achievements.fresh_save.body', { n: 0 })}
              </Label>
            </View>
          ) : (
            <>
              {unlockedEntries.length > 0 ? (
                <Label variant="xs" tone="muted" style={styles.sectionHeader}>
                  {t('achievements.unlocked_section')}
                </Label>
              ) : null}
              {unlockedEntries.map((entry) => (
                <View key={entry.id} style={styles.entryRow}>
                  <Label variant="sm" tone="accent">
                    {t(entry.nameKey)}
                  </Label>
                  <Label variant="xs" tone="muted">
                    {t(entry.descKey)}
                  </Label>
                </View>
              ))}
              {lockedEntries.length > 0 ? (
                <Label variant="xs" tone="muted" style={styles.sectionHeader}>
                  {t('achievements.locked_section')}
                </Label>
              ) : null}
              {lockedEntries.map((entry) => (
                <View key={entry.id} style={[styles.entryRow, styles.entryLocked]}>
                  <Label variant="sm" tone="muted">
                    {'???'}
                  </Label>
                  <Label variant="xs" tone="muted">
                    {entry.hint === 'always' ? t(entry.descKey) : t('achievements.locked_hint')}
                  </Label>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        <View style={styles.backRow}>
          <Button label={t('menu.save_select.back')} variant="ghost" onPress={actions.goMenu} />
        </View>
      </Panel>
    </View>
  );
}
