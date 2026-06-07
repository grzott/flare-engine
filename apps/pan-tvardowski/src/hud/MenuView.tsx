import { Button } from '@flare-engine/ui';
import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rawStyles } from './MenuOverlay.styles';
import type { MenuOverlayProps } from './MenuOverlay.types';

const styles = StyleSheet.create(rawStyles);

export function MenuView({
  localization: l,
  actions,
  appVersion,
}: MenuOverlayProps): React.ReactElement {
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
