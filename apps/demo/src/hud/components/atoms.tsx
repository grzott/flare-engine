import { Button, Label } from '@flare-engine/ui';
import React from 'react';
import { View } from 'react-native';
import type { RunStats, SlotMeta } from '../../state';
import { requestReset } from '../helpers';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';

/** Single slot row with optional reset button. */
export const SlotRow = React.memo(function SlotRow(props: {
  index: number;
  slot: SlotMeta | null;
  pending: boolean;
}): React.ReactElement {
  const { index, slot, pending } = props;
  const label = slot
    ? `SLOT ${index + 1} · BEST ${slot.bestScore} · RUNS ${slot.runs}`
    : `SLOT ${index + 1} — NEW`;
  return (
    <View style={styles.slotRow}>
      <View style={styles.slotMain}>
        <Button label={label} variant="secondary" onPress={() => menuActions.onPickSlot(index)} />
      </View>
      {slot ? (
        <View style={styles.slotReset}>
          <Button
            label={pending ? 'CONFIRM' : 'RESET'}
            variant={pending ? 'danger' : 'ghost'}
            onPress={() => {
              if (pending) {
                menuActions.onResetSlot(index);
                requestReset(null);
              } else {
                requestReset(index);
              }
            }}
          />
        </View>
      ) : null}
    </View>
  );
});

/** Numeric 0..1 setting row with - / + buttons and percent display. */
export const SettingRow = React.memo(function SettingRow(props: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}): React.ReactElement {
  const { label, value, onChange } = props;
  return (
    <View style={styles.settingRow}>
      <Label variant="sm" style={styles.settingLabel}>
        {label}
      </Label>
      <View style={styles.settingButtons}>
        <Button
          label="-"
          variant="ghost"
          onPress={() => onChange(Math.max(0, Math.round((value - 0.1) * 10) / 10))}
        />
        <Label variant="sm" mono style={styles.settingValue}>
          {`${Math.round(value * 100)}%`}
        </Label>
        <Button
          label="+"
          variant="ghost"
          onPress={() => onChange(Math.min(1, Math.round((value + 0.1) * 10) / 10))}
        />
      </View>
    </View>
  );
});

/** Boolean ON/OFF toggle row. */
export const ToggleRow = React.memo(function ToggleRow(props: {
  label: string;
  value: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <View style={styles.settingRow}>
      <Label variant="sm" style={styles.settingLabel}>
        {props.label}
      </Label>
      <Button
        label={props.value ? 'ON' : 'OFF'}
        variant={props.value ? 'primary' : 'ghost'}
        onPress={props.onToggle}
      />
    </View>
  );
});

const SummaryRow = React.memo(function SummaryRow(props: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Label variant="sm" tone="muted">
        {props.label}
      </Label>
      <Label variant="sm" mono>
        {props.value}
      </Label>
    </View>
  );
});

/** Three-row leaderboard for the base-hub SCORES tile. */
export const LeaderboardBody = React.memo(function LeaderboardBody(props: {
  slots: (SlotMeta | null)[];
}): React.ReactElement {
  const rows = props.slots.map((slot, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-slot layout
    <Label key={`slot-${i}`} variant="sm" mono style={styles.leaderRow}>
      {slot
        ? `SLOT ${i + 1}  BEST ${String(slot.bestScore).padStart(
            6,
            '0',
          )}  RUNS ${slot.runs}  KILLS ${slot.totalKills}`
        : `SLOT ${i + 1}  —`}
    </Label>
  ));
  return <View style={styles.leaderWrap}>{rows}</View>;
});

/** End-of-run stats panel shared by VICTORY and GAME OVER screens. */
export const EndSummary = React.memo(function EndSummary(props: {
  run: RunStats;
  slot: SlotMeta | null;
}): React.ReactElement {
  const { run, slot } = props;
  const totalKills = run.kills.straight + run.kills.sine + run.kills.diagonal + run.kills.boss;
  return (
    <View style={styles.summaryWrap}>
      <SummaryRow label="SCORE" value={run.score.toString()} />
      <SummaryRow label="BEST" value={(slot?.bestScore ?? 0).toString()} />
      <SummaryRow label="TIME" value={`${run.durationSec.toFixed(1)}s`} />
      <SummaryRow label="KILLS" value={`${totalKills} (${run.kills.boss} boss)`} />
      <SummaryRow label="BOMBS" value={run.bombsUsed.toString()} />
      <SummaryRow label="DAMAGE" value={run.damageTaken.toString()} />
    </View>
  );
});
