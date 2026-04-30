import type { LocalizationManager } from '@flare-engine/localization';
import { Button, FocusProvider, Label, Panel, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CODEX_ENTRIES } from '../codex';
import { findBossExtra } from '../codex/boss-entries';
import type { SaveStore } from '../save/store';
import { filterCodexEntries } from '../scenes/codex-shards';
import { type GameState, gameState, stateChanged } from '../state';
import { rawStyles } from './CodexOverlay.styles';

const styles = StyleSheet.create(rawStyles);

export interface CodexOverlayActions {
  goMenu(): void;
}

export interface CodexOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: CodexOverlayActions;
}

function cloneState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}

export function CodexOverlay(props: CodexOverlayProps): React.ReactElement | null {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  if (s.currentScene !== 'codex-shards') return null;

  return (
    <View style={styles.root}>
      <ThemeProvider theme={darkTheme}>
        <FocusProvider>
          <CodexView {...props} />
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}

function CodexView({ localization: l, save, actions }: CodexOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);

  const { unlocked: unlockedEntries, locked: lockedEntries } = useMemo(
    () => filterCodexEntries(CODEX_ENTRIES, save.codexUnlocked()),
    [save],
  );

  const slot = save.getSlot(gameState.activeSlot);
  const shardCount = slot?.bestScore ?? 0;
  const unlockedCount = save.codexUnlocked().length;

  return (
    <View style={styles.panelContainer}>
      <Panel padding="lg" radius="lg" style={styles.panel}>
        <Label variant="xl" tone="accent" style={styles.title}>
          {t('codex.title')}
        </Label>

        <Label variant="md" style={styles.shardHeader}>
          {t('inventory.shards.collected', { n: shardCount })}
        </Label>

        <Label variant="sm" tone="muted" style={styles.subheader}>
          {`${unlockedCount} / ${CODEX_ENTRIES.length}`}
        </Label>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {unlockedCount === 0 ? (
            <View style={styles.entryRow}>
              <Label variant="sm" tone="accent">
                {t('codex.fresh_save.heading')}
              </Label>
              <Label variant="xs" tone="muted">
                {t('codex.fresh_save.body', { n: 0 })}
              </Label>
            </View>
          ) : (
            <>
              {unlockedEntries.map((entry) => {
                const bossExtra = entry.category === 'boss' ? findBossExtra(entry.id) : undefined;
                return (
                  <View key={entry.id} style={[styles.entryRow, styles.entryUnlocked]}>
                    <Label variant="sm" tone="accent">
                      {t(entry.nameKey)}
                    </Label>
                    <Label variant="xs" tone="muted">
                      {t(entry.loreKey)}
                    </Label>
                    {bossExtra !== undefined && (
                      <View style={styles.phaseBlock}>
                        {bossExtra.phaseStatsKeys.map((key) => (
                          <Label key={key} variant="xs" tone="muted" style={styles.phaseLine}>
                            {t(key)}
                          </Label>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
              {lockedEntries.map((entry) => (
                <View key={entry.id} style={[styles.entryRow, styles.entryLocked]}>
                  <Label variant="sm" tone="muted">
                    {'???'}
                  </Label>
                  <Label variant="xs" tone="muted">
                    {t('inventory.codex.locked')}
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
