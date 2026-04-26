import type { LocalizationManager } from '@flare-engine/localization';
import {
  Button,
  FocusProvider,
  Label,
  MainMenuKit,
  Panel,
  ThemeProvider,
  darkTheme,
} from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatLastPlayed, slotPreview } from '../save/preview';
import type { SaveStore } from '../save/store';
import { type GameState, gameState, stateChanged } from '../state';
import type { FireButtonSide, JoystickSide } from '../state';
import { CREDITS_SECTIONS } from './credits-sections';

export interface MenuOverlayActions {
  goMenu(): void;
  goSaveSelect(): void;
  goSettings(): void;
  goCredits(): void;
  goInventory(): void;
  startSlot(index: 0 | 1 | 2): void;
  persistSettings(): void;
}

export interface MenuOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: MenuOverlayActions;
  appVersion: string;
  onLocaleChange(locale: 'en' | 'pl'): void;
  onVolumesChange(volumes: { master: number; music: number; sfx: number }): void;
}

function cloneState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}

export function MenuOverlay(props: MenuOverlayProps): React.ReactElement | null {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  const scene = s.currentScene;
  const show =
    scene === 'menu' || scene === 'save-select' || scene === 'settings' || scene === 'credits';
  if (!show) return null;

  return (
    <View style={styles.root}>
      <ThemeProvider theme={darkTheme}>
        <FocusProvider>
          {scene === 'menu' ? <MenuView {...props} /> : null}
          {scene === 'save-select' ? <SaveSelectView {...props} /> : null}
          {scene === 'settings' ? <SettingsView {...props} settings={s.settings} /> : null}
          {scene === 'credits' ? <CreditsView {...props} /> : null}
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}

function MenuView({ localization: l, actions, appVersion }: MenuOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);
  const items = [
    { id: 'play', label: t('menu.play'), onPress: actions.goSaveSelect },
    { id: 'inventory', label: t('menu.inventory'), onPress: actions.goInventory },
    { id: 'settings', label: t('menu.settings'), onPress: actions.goSettings },
    { id: 'credits', label: t('menu.credits'), onPress: actions.goCredits },
  ];
  const footer = (
    <Label variant="xs" tone="muted">
      {`v${appVersion} · ${l.locale}`}
    </Label>
  );
  return (
    <MainMenuKit
      title={t('menu.title')}
      subtitle={t('menu.subtitle')}
      items={items}
      footer={footer}
    />
  );
}

function SaveSelectView({ localization: l, save, actions }: MenuOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);
  const previews = useMemo(() => [0, 1, 2].map((i) => slotPreview(i, save.getSlot(i))), [save]);
  return (
    <View style={styles.panelContainer}>
      <Panel padding="lg" radius="lg" style={styles.panel}>
        <Label variant="xl" tone="accent" style={{ marginBottom: 12 }}>
          {t('menu.save_select.title')}
        </Label>
        {previews.map((p) => {
          const zoneNum = p.zoneReached.slice(1);
          const when = formatLastPlayed(p.lastPlayed, l.locale === 'pl' ? 'pl' : 'en');
          return (
            <Panel
              key={p.index}
              variant="elevated"
              padding="md"
              radius="md"
              style={{ marginBottom: 8 }}
            >
              <Pressable
                onPress={() => actions.startSlot(p.index as 0 | 1 | 2)}
                accessibilityRole="button"
              >
                {p.status === 'empty' ? (
                  <Label variant="md" tone="muted">
                    {`#${p.index + 1} — ${t('menu.save_select.empty')}`}
                  </Label>
                ) : (
                  <View>
                    <Label variant="md">
                      {`#${p.index + 1} — ${t('menu.save_select.zone', { zone: zoneNum })}`}
                    </Label>
                    <Label variant="sm" tone="muted">
                      {t('menu.save_select.best_score', { score: p.bestScore })}
                    </Label>
                    {when.length > 0 ? (
                      <Label variant="xs" tone="muted">
                        {t('menu.save_select.last_played', { when })}
                      </Label>
                    ) : null}
                  </View>
                )}
              </Pressable>
            </Panel>
          );
        })}
        <View style={{ marginTop: 12 }}>
          <Button label={t('menu.save_select.back')} variant="ghost" onPress={actions.goMenu} />
        </View>
      </Panel>
    </View>
  );
}

interface SettingsViewProps extends MenuOverlayProps {
  settings: GameState['settings'];
}

function SettingsView({
  localization: l,
  settings,
  actions,
  onLocaleChange,
  onVolumesChange,
  save,
}: SettingsViewProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);

  const setLocale = (loc: 'en' | 'pl'): void => {
    gameState.settings.locale = loc;
    onLocaleChange(loc);
    stateChanged.emit();
  };
  const bumpVolume = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', delta: number): void => {
    const next = Math.max(0, Math.min(1, Math.round((settings[key] + delta) * 10) / 10));
    gameState.settings[key] = next;
    onVolumesChange({
      master: gameState.settings.masterVolume,
      music: gameState.settings.musicVolume,
      sfx: gameState.settings.sfxVolume,
    });
    stateChanged.emit();
  };
  const toggleReducedMotion = (): void => {
    gameState.settings.reducedMotion = !gameState.settings.reducedMotion;
    stateChanged.emit();
  };
  const setJoystickSide = (side: JoystickSide): void => {
    gameState.settings.controls.joystickSide = side;
    stateChanged.emit();
  };
  const setFireSide = (side: FireButtonSide): void => {
    gameState.settings.controls.fireButtonSide = side;
    stateChanged.emit();
  };

  const volumeRow = (
    labelKey: string,
    field: 'masterVolume' | 'musicVolume' | 'sfxVolume',
  ): React.ReactElement => (
    <View style={styles.row} key={field}>
      <Label variant="sm" style={styles.rowLabel}>
        {t(labelKey)}
      </Label>
      <View style={styles.rowControls}>
        <Button label="-" variant="secondary" onPress={() => bumpVolume(field, -0.1)} />
        <Label variant="sm" style={styles.rowValue}>
          {`${Math.round(settings[field] * 100)}%`}
        </Label>
        <Button label="+" variant="secondary" onPress={() => bumpVolume(field, 0.1)} />
      </View>
    </View>
  );

  return (
    <View style={styles.panelContainer}>
      <Panel padding="lg" radius="lg" style={styles.panel}>
        <Label variant="xl" tone="accent" style={{ marginBottom: 12 }}>
          {t('menu.settings.title')}
        </Label>

        <View style={styles.row}>
          <Label variant="sm" style={styles.rowLabel}>
            {t('menu.settings.language')}
          </Label>
          <View style={styles.rowControls}>
            <Button
              label="EN"
              variant={settings.locale === 'en' ? 'primary' : 'secondary'}
              onPress={() => setLocale('en')}
            />
            <Button
              label="PL"
              variant={settings.locale === 'pl' ? 'primary' : 'secondary'}
              onPress={() => setLocale('pl')}
            />
          </View>
        </View>

        {volumeRow('menu.settings.audio.master', 'masterVolume')}
        {volumeRow('menu.settings.audio.music', 'musicVolume')}
        {volumeRow('menu.settings.audio.sfx', 'sfxVolume')}

        <View style={styles.row}>
          <Label variant="sm" style={styles.rowLabel}>
            {t('menu.settings.reduced_motion')}
          </Label>
          <View style={styles.rowControls}>
            <Button
              label={settings.reducedMotion ? 'ON' : 'OFF'}
              variant={settings.reducedMotion ? 'primary' : 'secondary'}
              onPress={toggleReducedMotion}
            />
          </View>
        </View>

        <View style={styles.row}>
          <Label variant="sm" style={styles.rowLabel}>
            {t('menu.settings.controls.joystick_side')}
          </Label>
          <View style={styles.rowControls}>
            <Button
              label={t('menu.settings.controls.left')}
              variant={settings.controls.joystickSide === 'left' ? 'primary' : 'secondary'}
              onPress={() => setJoystickSide('left')}
            />
            <Button
              label={t('menu.settings.controls.right')}
              variant={settings.controls.joystickSide === 'right' ? 'primary' : 'secondary'}
              onPress={() => setJoystickSide('right')}
            />
          </View>
        </View>

        <View style={styles.row}>
          <Label variant="sm" style={styles.rowLabel}>
            {t('menu.settings.controls.fire_side')}
          </Label>
          <View style={styles.rowControls}>
            <Button
              label={t('menu.settings.controls.left')}
              variant={settings.controls.fireButtonSide === 'left' ? 'primary' : 'secondary'}
              onPress={() => setFireSide('left')}
            />
            <Button
              label={t('menu.settings.controls.right')}
              variant={settings.controls.fireButtonSide === 'right' ? 'primary' : 'secondary'}
              onPress={() => setFireSide('right')}
            />
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Button
            label={t('menu.settings.back')}
            variant="ghost"
            onPress={() => {
              actions.persistSettings();
              void save.persist();
              actions.goMenu();
            }}
          />
        </View>
      </Panel>
    </View>
  );
}

function CreditsView({ localization: l, actions }: MenuOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);
  return (
    <Pressable style={styles.creditsRoot} onPress={actions.goMenu}>
      <Label variant="xl" tone="accent" style={styles.creditsTitle}>
        {t('menu.credits.title')}
      </Label>
      <ScrollView
        style={styles.creditsScroll}
        contentContainerStyle={styles.creditsContent}
        pointerEvents="none"
      >
        {CREDITS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.creditsSection}>
            <Text style={styles.creditsSectionTitle}>{section.title}</Text>
            {section.lines.map((line) => (
              <Text key={line} style={styles.creditsLine}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
      <Text style={styles.creditsSkip}>{t('menu.credits.skip')}</Text>
    </Pressable>
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
  panel: { alignSelf: 'stretch', maxWidth: 420, width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  rowLabel: { flex: 1 },
  rowControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { minWidth: 48, textAlign: 'center' },
  creditsRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  creditsTitle: { marginBottom: 12 },
  creditsScroll: { alignSelf: 'stretch', maxHeight: '70%' },
  creditsContent: { paddingHorizontal: 12, paddingVertical: 16, alignItems: 'center' },
  creditsSection: { marginBottom: 20, alignItems: 'center' },
  creditsSectionTitle: {
    color: '#f3d6a4',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  creditsLine: {
    color: '#d7cbb8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  creditsSkip: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 1,
  },
});
