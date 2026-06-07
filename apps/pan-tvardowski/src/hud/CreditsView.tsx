import { Label } from '@flare-engine/ui';
import type React from 'react';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { rawStyles } from './MenuOverlay.styles';
import type { MenuOverlayProps } from './MenuOverlay.types';
import { CREDITS_SECTIONS } from './credits-sections';

const styles = StyleSheet.create(rawStyles);

export function CreditsView({ localization: l, actions }: MenuOverlayProps): React.ReactElement {
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
