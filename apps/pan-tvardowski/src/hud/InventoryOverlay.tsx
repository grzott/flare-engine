import type { LocalizationManager } from '@flare-engine/localization';
import { Button, Label, Panel } from '@flare-engine/ui';
import type React from 'react';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CODEX_ENTRIES } from '../codex';
import type { SaveStore } from '../save/store';
import { type GameState, gameState, notifyStateChanged } from '../state';
import { HudPanelScaffold } from './HudPanelScaffold';
import { rawStyles } from './InventoryOverlay.styles';
import { ACHIEVEMENTS } from './achievements-list';
import type { InventoryTab } from './inventory-tab';
import { useHudState } from './useHudState';

const styles = StyleSheet.create(rawStyles);

export interface InventoryOverlayActions {
  goMenu(): void;
}

export interface InventoryOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: InventoryOverlayActions;
}

function cloneInventoryState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
    bootProgress: { ...gameState.bootProgress },
  };
}

export function InventoryOverlay(props: InventoryOverlayProps): React.ReactElement | null {
  const s = useHudState(cloneInventoryState);

  if (s.currentScene !== 'inventory') return null;

  return (
    <View style={styles.root}>
      <HudPanelScaffold>
        <InventoryView
          {...props}
          activeTab={s.inventoryActiveTab}
          onTabChange={(tab: InventoryTab) => {
            gameState.inventoryActiveTab = tab;
            notifyStateChanged();
          }}
        />
      </HudPanelScaffold>
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
