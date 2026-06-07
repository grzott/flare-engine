import { Button, Label, Panel } from '@flare-engine/ui';
import { RestorePurchasesButton } from '@flare-engine/ui-shop';
import type React from 'react';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { gameEvents } from '../events';
import type { GameState } from '../state';
import { THEME_SPEC } from '../visual-spec/theme';
import { rawStyles } from './MenuOverlay.styles';
import type { MenuOverlayProps } from './MenuOverlay.types';
import { PrivacyOverlay } from './PrivacyOverlay';
import { useSettingsHandlers } from './useSettingsHandlers';

const styles = StyleSheet.create(rawStyles);

interface SettingsViewProps extends MenuOverlayProps {
  settings: GameState['settings'];
}

export function SettingsView({
  localization: l,
  settings,
  actions,
  onLocaleChange,
  onVolumesChange,
  save,
  entitlementStore,
}: SettingsViewProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);
  const {
    privacyVisible,
    setPrivacyVisible,
    privacy,
    setLocale,
    bumpVolume,
    toggleReducedMotion,
    toggleColorBlindMode,
    setJoystickSide,
    setFireSide,
    togglePrivacyField,
    back,
  } = useSettingsHandlers(settings, save, actions, onLocaleChange, onVolumesChange);

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
        <Pressable style={styles.settingsCloseBtn} onPress={back} accessibilityRole="button">
          <Text style={styles.settingsCloseBtnLabel}>{'×'}</Text>
        </Pressable>
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
          <Button label={t('menu.settings.back')} variant="ghost" onPress={back} />
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
