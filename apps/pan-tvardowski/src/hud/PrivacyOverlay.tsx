import type { LocalizationManager } from '@flare-engine/localization';
import { Button, Label, Panel } from '@flare-engine/ui';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import type { PrivacySettings } from '../save/schema';
import type { SaveStore } from '../save/store';

export interface PrivacyOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  visible: boolean;
  onClose: () => void;
}

export function PrivacyOverlay({
  localization: l,
  save,
  visible,
  onClose,
}: PrivacyOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string) => l.t(k), [l]);

  const [privacy, setPrivacyState] = useState<PrivacySettings>(() => save.privacy());

  const toggle = (field: keyof PrivacySettings): void => {
    const next: PrivacySettings = { ...privacy, [field]: !privacy[field] };
    setPrivacyState(next);
    void save.setPrivacy(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Panel padding="lg" radius="lg" style={styles.panel}>
          <Label variant="xl" tone="accent" style={styles.title}>
            {t('settings.privacy.title')}
          </Label>

          <View style={styles.row}>
            <Label variant="sm" style={styles.rowLabel}>
              {t('settings.privacy.analytics_label')}
            </Label>
            <Button
              label={privacy.analyticsOptIn ? t('settings.privacy.on') : t('settings.privacy.off')}
              variant={privacy.analyticsOptIn ? 'primary' : 'secondary'}
              onPress={() => toggle('analyticsOptIn')}
            />
          </View>

          <View style={styles.row}>
            <Label variant="sm" style={styles.rowLabel}>
              {t('settings.privacy.crash_label')}
            </Label>
            <Button
              label={privacy.crashOptIn ? t('settings.privacy.on') : t('settings.privacy.off')}
              variant={privacy.crashOptIn ? 'primary' : 'secondary'}
              onPress={() => toggle('crashOptIn')}
            />
          </View>

          <Label variant="sm" tone="muted" style={styles.dataHeading}>
            {t('settings.privacy.data_heading')}
          </Label>
          <Label variant="xs" tone="muted" style={styles.dataNote}>
            {t('settings.privacy.data_note')}
          </Label>

          <View style={styles.closeRow}>
            <Button label={t('settings.privacy.close')} variant="ghost" onPress={onClose} />
          </View>
        </Panel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 16, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: { alignSelf: 'stretch', maxWidth: 420, width: '100%' },
  title: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  rowLabel: { flex: 1, marginRight: 8 },
  dataHeading: { marginTop: 16, marginBottom: 4 },
  dataNote: { marginBottom: 8 },
  closeRow: { marginTop: 12 },
});
