import type { LocalizationManager } from '@flare-engine/localization';
import { Button, FocusProvider, Label, Panel, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CODEX_ENTRIES } from '../codex';
import type { SaveStore } from '../save/store';
import { type GameState, gameState, stateChanged } from '../state';
import { ACHIEVEMENTS } from './achievements-list';

export type InventoryTab = 'codex' | 'shards' | 'stats' | 'achievements';

export interface InventoryOverlayActions {
  goMenu(): void;
}

export interface InventoryOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: InventoryOverlayActions;
}

function cloneState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}

export function InventoryOverlay(props: InventoryOverlayProps): React.ReactElement | null {
  const [s, setS] = useState<GameState>(() => cloneState());
  const [activeTab, setActiveTab] = useState<InventoryTab>('codex');

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  if (s.currentScene !== 'inventory') return null;

  return (
    <View style={styles.root}>
      <ThemeProvider theme={darkTheme}>
        <FocusProvider>
          <InventoryView {...props} activeTab={activeTab} onTabChange={setActiveTab} />
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}

interface InventoryViewProps extends InventoryOverlayProps {
  activeTab: InventoryTab;
  onTabChange(tab: InventoryTab): void;
}

function InventoryView({
  localization: l,
  save,
  actions,
  activeTab,
  onTabChange,
}: InventoryViewProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);

  return (
    <View style={styles.panelContainer}>
      <Panel padding="lg" radius="lg" style={styles.panel}>
        <View style={styles.tabs}>
          {(['codex', 'shards', 'stats', 'achievements'] as InventoryTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => onTabChange(tab)}
              accessibilityRole="tab"
            >
              <Label variant="sm" tone={activeTab === tab ? 'accent' : 'muted'}>
                {t(`inventory.tab.${tab}`)}
              </Label>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'codex' ? <CodexTab t={t} save={save} /> : null}
          {activeTab === 'shards' ? <ShardsTab t={t} save={save} /> : null}
          {activeTab === 'stats' ? <StatsTab t={t} save={save} /> : null}
          {activeTab === 'achievements' ? <AchievementsTab t={t} /> : null}
        </View>

        <View style={styles.backRow}>
          <Button label={t('inventory.back')} variant="ghost" onPress={actions.goMenu} />
        </View>
      </Panel>
    </View>
  );
}

type Translator = (key: string, params?: Record<string, string | number>) => string;

function CodexTab({ t, save }: { t: Translator; save: SaveStore }): React.ReactElement {
  const unlocked = useMemo(() => new Set(save.codexUnlocked()), [save]);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {CODEX_ENTRIES.map((entry) => {
        const isUnlocked = unlocked.has(entry.id);
        return (
          <View key={entry.id} style={styles.codexRow}>
            <Label variant="sm" tone={isUnlocked ? 'accent' : 'muted'}>
              {isUnlocked ? t(entry.nameKey) : '???'}
            </Label>
            {isUnlocked ? (
              <Label variant="xs" tone="muted">
                {t(entry.loreKey)}
              </Label>
            ) : (
              <Label variant="xs" tone="muted">
                {t('inventory.codex.locked')}
              </Label>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function ShardsTab({ t, save }: { t: Translator; save: SaveStore }): React.ReactElement {
  const slot = save.getSlot(gameState.activeSlot);
  const shardCount = slot ? slot.bestScore : 0;
  return (
    <View style={styles.centeredContent}>
      <Label variant="lg" tone="accent">
        {t('inventory.shards.collected', { n: shardCount })}
      </Label>
    </View>
  );
}

function StatsTab({ t, save }: { t: Translator; save: SaveStore }): React.ReactElement {
  const slot = save.getSlot(gameState.activeSlot);
  if (!slot) {
    return (
      <View style={styles.centeredContent}>
        <Label variant="md" tone="muted">
          {t('inventory.stats.runs', { n: 0 })}
        </Label>
      </View>
    );
  }
  const zoneNum = slot.zoneReached.slice(1);
  return (
    <View style={styles.centeredContent}>
      <Label variant="md" style={styles.statRow}>
        {t('inventory.stats.zone', { zone: zoneNum })}
      </Label>
      <Label variant="md" style={styles.statRow}>
        {t('inventory.stats.best_score', { score: slot.bestScore })}
      </Label>
      <Label variant="md" style={styles.statRow}>
        {t('inventory.stats.runs', { n: slot.runs })}
      </Label>
    </View>
  );
}

function AchievementsTab({ t }: { t: Translator }): React.ReactElement {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {ACHIEVEMENTS.map((ach) => (
        <View key={ach.id} style={styles.achRow}>
          <Label variant="sm" tone="accent">
            {t(ach.nameKey)}
          </Label>
          <Label variant="xs" tone="muted">
            {t(ach.descKey)}
          </Label>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 16, 0.92)',
    justifyContent: 'center',
  },
  panelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: { alignSelf: 'stretch', maxWidth: 440, width: '100%', maxHeight: '90%' },
  tabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#f3d6a4',
  },
  tabContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  codexRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  achRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  statRow: { marginBottom: 8 },
  backRow: { marginTop: 12 },
});
