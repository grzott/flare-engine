import { Button, Label, Panel } from '@flare-engine/ui';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ZONES } from '../config/zones';
import { gameEvents } from '../events';
import type { ZoneId } from '../events';
import { ENTITLEMENT_FULL_GAME } from '../iap/catalog';
import { formatLastPlayed, slotPreview } from '../save/preview';
import { rawStyles } from './MenuOverlay.styles';
import type { MenuOverlayProps } from './MenuOverlay.types';

const styles = StyleSheet.create(rawStyles);

const ZONE_ORDER: readonly ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];

function zonesUpTo(zoneReached: ZoneId): readonly ZoneId[] {
  if (__DEV__) return ZONE_ORDER;
  const idx = ZONE_ORDER.indexOf(zoneReached);
  return idx < 0 ? ['z1'] : ZONE_ORDER.slice(0, idx + 1);
}

const ROMAN = ['I', 'II', 'III'] as const;

export function SaveSelectView({
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
