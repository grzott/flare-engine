import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { Button, FocusProvider, Label, Panel, ThemeProvider, darkTheme } from '@flare-engine/ui';
import { RestorePurchasesButton } from '@flare-engine/ui-shop';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ZONES } from '../config/zones';
import { gameEvents } from '../events';
import type { ZoneId } from '../events';
import { ENTITLEMENT_FULL_GAME } from '../iap/catalog';
import { formatLastPlayed, slotPreview } from '../save/preview';
import type { SaveStore } from '../save/store';
import { type GameState, gameState, stateChanged } from '../state';
import type { FireButtonSide, JoystickSide } from '../state';
import { THEME_SPEC } from '../visual-spec/theme';
import { rawStyles } from './MenuOverlay.styles';
import { PrivacyOverlay } from './PrivacyOverlay';
import { CREDITS_SECTIONS } from './credits-sections';

const ZONE_ORDER: readonly ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];

function zonesUpTo(zoneReached: ZoneId): readonly ZoneId[] {
  if (__DEV__) return ZONE_ORDER;
  const idx = ZONE_ORDER.indexOf(zoneReached);
  return idx < 0 ? ['z1'] : ZONE_ORDER.slice(0, idx + 1);
}

export interface MenuOverlayActions {
  goMenu(): void;
  goSaveSelect(): void;
  goSettings(): void;
  goCredits(): void;
  goInventory(): void;
  goCodex(): void;
  goAchievements(): void;
  goShop(): void;
  startSlot(index: 0 | 1 | 2): void;
  startSlotAtZone(index: 0 | 1 | 2, zoneId: ZoneId): void;
  persistSettings(): void;
}

export interface MenuOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: MenuOverlayActions;
  appVersion: string;
  onLocaleChange(locale: 'en' | 'pl'): void;
  onVolumesChange(volumes: { master: number; music: number; sfx: number }): void;
  entitlementStore?: EntitlementStore;
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
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={styles.menuSigil} pointerEvents="none" />
      <Text style={styles.menuTitle}>{t('menu.title')}</Text>
      <Text style={styles.menuSubtitle}>{t('menu.subtitle')}</Text>
      <View style={styles.menuButtonStack}>
        <Button label={t('menu.play')} variant="primary" onPress={actions.goSaveSelect} />
        <Button label={t('menu.settings')} variant="secondary" onPress={actions.goSettings} />
        <Button label={t('menu.credits')} variant="ghost" onPress={actions.goCredits} />
        <Button label={t('menu.shop')} variant="ghost" onPress={actions.goShop} />
      </View>
      <Text style={styles.menuVersionLabel}>{`v${appVersion} · ${l.locale}`}</Text>
    </View>
  );
}

const ROMAN = ['I', 'II', 'III'] as const;

function SaveSelectView({
  localization: l,
  save,
  actions,
  entitlementStore,
}: MenuOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);
  const previews = useMemo(() => [0, 1, 2].map((i) => slotPreview(i, save.getSlot(i))), [save]);
  const isFullGameOwned = entitlementStore?.isEntitled(ENTITLEMENT_FULL_GAME) ?? false;
  const [selectedSlotForZoneSelect, setSelectedSlotForZoneSelect] = useState<number | null>(null);

  if (selectedSlotForZoneSelect !== null) {
    const slotData = save.getSlot(selectedSlotForZoneSelect);
    const zoneReached: ZoneId = slotData?.zoneReached ?? 'z1';
    const availableZones = zonesUpTo(zoneReached);
    return (
      <View style={styles.panelContainer}>
        <Panel padding="lg" radius="lg" style={styles.panel}>
          <Label variant="xl" tone="accent" style={{ marginBottom: 12 }}>
            {t('menu.zone_select.title')}
          </Label>
          {availableZones.map((zoneId) => {
            const zoneNum = zoneId.slice(1);
            const cfg = ZONES[zoneId];
            const name = cfg ? t(cfg.nameKey) : zoneNum;
            const cleared = zoneId !== zoneReached;
            return (
              <Pressable
                key={zoneId}
                style={styles.zoneSelectItem}
                onPress={() => {
                  setSelectedSlotForZoneSelect(null);
                  actions.startSlotAtZone(selectedSlotForZoneSelect as 0 | 1 | 2, zoneId);
                }}
                accessibilityRole="button"
              >
                <Label variant="md">{t('menu.zone_select.zone', { zone: zoneNum, name })}</Label>
                {cleared ? (
                  <Label variant="xs" tone="muted">
                    {t('menu.zone_select.zone_cleared')}
                  </Label>
                ) : null}
              </Pressable>
            );
          })}
          <View style={styles.zoneSelectBack}>
            <Button
              label={t('menu.zone_select.back')}
              variant="ghost"
              onPress={() => setSelectedSlotForZoneSelect(null)}
            />
          </View>
        </Panel>
      </View>
    );
  }

  return (
    <View style={styles.panelContainer}>
      <Label variant="xl" tone="accent" style={{ marginBottom: 12 }}>
        {t('menu.save_select.title')}
      </Label>
      {previews.map((p) => {
        const zoneNum = p.zoneReached.slice(1);
        const when = formatLastPlayed(p.lastPlayed, l.locale === 'pl' ? 'pl' : 'en');
        const zoneConfig = ZONES[p.zoneReached];
        const isLocked =
          !isFullGameOwned &&
          zoneConfig !== undefined &&
          zoneConfig.requiresEntitlement !== undefined;
        const canChooseZone = __DEV__ || (p.status !== 'empty' && p.zoneReached !== 'z1');
        const numeral = ROMAN[p.index] ?? String(p.index + 1);
        return (
          <Pressable
            key={p.index}
            style={styles.slotZonePreview}
            onPress={() => {
              if (isLocked) {
                gameEvents.emit('paywall-trigger', 'zone-locked-click');
                return;
              }
              if (canChooseZone) {
                setSelectedSlotForZoneSelect(p.index);
                return;
              }
              actions.startSlot(p.index as 0 | 1 | 2);
            }}
            accessibilityRole="button"
          >
            {p.status === 'empty' ? (
              <Text style={styles.slotEmpty}>{t('menu.save_select.new_game')}</Text>
            ) : (
              <View>
                <Text style={styles.slotZoneNumeral}>{numeral}</Text>
                <View style={styles.slotRow}>
                  <Text style={styles.slotZoneName}>
                    {t('menu.save_select.zone', { zone: zoneNum })}
                  </Text>
                  {isLocked ? (
                    <Label variant="sm" tone="muted" style={styles.lockedBadge}>
                      {t('menu.zone.locked')}
                    </Label>
                  ) : null}
                </View>
                <Text style={styles.slotStats}>
                  {t('menu.save_select.best_score', { score: p.bestScore })}
                  {'  '}
                  {t('menu.save_select.runs', { count: p.runs ?? 0 })}
                </Text>
                {when.length > 0 ? (
                  <Text style={styles.slotStats}>
                    {t('menu.save_select.last_played', { when })}
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>
        );
      })}
      <View style={{ marginTop: 12, alignSelf: 'flex-start' as const }}>
        <Button label={t('menu.save_select.back')} variant="ghost" onPress={actions.goMenu} />
      </View>
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
  entitlementStore,
}: SettingsViewProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [privacy, setPrivacyState] = useState(() => save.privacy());

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
  const toggleColorBlindMode = (): void => {
    gameState.settings.colorBlindMode = !gameState.settings.colorBlindMode;
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
  const togglePrivacyField = (field: 'analyticsOptIn' | 'crashOptIn'): void => {
    const next = { ...privacy, [field]: !privacy[field] };
    setPrivacyState(next);
    void save.setPrivacy(next);
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
        <ScrollView>
          {/* Audio group */}
          <Text style={styles.settingsGroupHeading}>{t('settings.group.audio')}</Text>
          {volumeRow('menu.settings.audio.master', 'masterVolume')}
          {volumeRow('menu.settings.audio.music', 'musicVolume')}
          {volumeRow('menu.settings.audio.sfx', 'sfxVolume')}

          {/* Accessibility group */}
          <Text style={styles.settingsGroupHeading}>{t('settings.group.accessibility')}</Text>
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
              {t('menu.settings.color_blind_mode')}
            </Label>
            <View style={styles.rowControls}>
              <Button
                label={settings.colorBlindMode ? 'ON' : 'OFF'}
                variant={settings.colorBlindMode ? 'primary' : 'secondary'}
                onPress={toggleColorBlindMode}
              />
            </View>
          </View>

          {/* Gameplay group */}
          <Text style={styles.settingsGroupHeading}>{t('settings.group.gameplay')}</Text>
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

          {/* Telemetry group */}
          <Text style={styles.settingsGroupHeading}>{t('settings.group.telemetry')}</Text>
          <View style={styles.row}>
            <Label variant="sm" style={styles.rowLabel}>
              {t('settings.privacy.analytics_label')}
            </Label>
            <View style={styles.rowControls}>
              <Button
                label={
                  privacy.analyticsOptIn ? t('settings.privacy.on') : t('settings.privacy.off')
                }
                variant={privacy.analyticsOptIn ? 'primary' : 'secondary'}
                onPress={() => togglePrivacyField('analyticsOptIn')}
              />
            </View>
          </View>

          <View style={styles.row}>
            <Label variant="sm" style={styles.rowLabel}>
              {t('settings.privacy.crash_label')}
            </Label>
            <View style={styles.rowControls}>
              <Button
                label={privacy.crashOptIn ? t('settings.privacy.on') : t('settings.privacy.off')}
                variant={privacy.crashOptIn ? 'primary' : 'secondary'}
                onPress={() => togglePrivacyField('crashOptIn')}
              />
            </View>
          </View>

          <View style={{ marginTop: THEME_SPEC.spacing.lg }}>
            <Button
              label={t('settings.privacy.title')}
              variant="secondary"
              onPress={() => setPrivacyVisible(true)}
            />
          </View>
        </ScrollView>

        {entitlementStore !== undefined ? (
          <View style={{ marginTop: THEME_SPEC.spacing.lg }}>
            <RestorePurchasesButton
              entitlementStore={entitlementStore}
              strings={{
                ctaKey: 'settings.restore.cta',
                loadingKey: 'settings.restore.loading',
                successKey: 'settings.restore.success',
                emptyKey: 'settings.restore.empty',
                errorKey: 'settings.restore.error',
              }}
              localize={(key) => t(key)}
              onComplete={(results) => {
                for (let i = 0; i < results.length; i++) {
                  const r = results[i];
                  if (r && r.status === 'purchased' && r.transaction) {
                    gameEvents.emit('purchase-completed', r.transaction.productId);
                  }
                }
              }}
              onError={(error) => {
                console.warn('[restore]', error);
              }}
            />
          </View>
        ) : null}
        <View style={{ marginTop: THEME_SPEC.spacing.lg }}>
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
      <PrivacyOverlay
        localization={l}
        save={save}
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
      />
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
          <View key={section.titleKey} style={styles.creditsSection}>
            <Text style={styles.creditsSectionTitle}>{t(section.titleKey)}</Text>
            {section.lineKeys.map((lineKey) => (
              <Text key={lineKey} style={styles.creditsLine}>
                {t(lineKey)}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
      <Text style={styles.creditsSkip}>{t('menu.credits.skip')}</Text>
    </Pressable>
  );
}

export { rawStyles } from './MenuOverlay.styles';

const styles = StyleSheet.create(rawStyles);
