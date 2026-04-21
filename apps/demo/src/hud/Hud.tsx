import {
  Button,
  FocusProvider,
  HUDBar,
  Label,
  Modal,
  Panel,
  ThemeProvider,
  darkTheme,
} from '@flare-engine/ui';
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { RunStats, SlotMeta } from '../state';
import { toggleShowFps } from './fps-state';
import { menuActions } from './menu-actions';
import { useDialogueLine } from './use-dialogue';
import { useFpsLine, useShowFps } from './use-fps-state';
import { useGameState } from './use-game-state';
import { useUiState } from './use-ui-state';

export function Hud(): React.ReactElement {
  return (
    <ThemeProvider theme={darkTheme}>
      <FocusProvider>
        <HudInner />
      </FocusProvider>
    </ThemeProvider>
  );
}

function HudInner(): React.ReactElement {
  const s = useGameState();
  const ui = useUiState();
  const fpsLine = useFpsLine();
  const showFps = useShowFps();
  const dialogue = useDialogueLine();
  const flashAlpha = s.bombFlashAlpha;

  const inPlay = s.currentScene === 'play';
  const isEnd = s.currentScene === 'game-over' || s.currentScene === 'victory';

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {flashAlpha > 0 ? (
        <View pointerEvents="none" style={[styles.flash, { opacity: flashAlpha }]} />
      ) : null}

      {inPlay ? (
        <>
          <View style={styles.topRow} pointerEvents="box-none">
            <Label variant="lg" style={styles.score}>
              {`SCORE ${s.score.toString().padStart(6, '0')}`}
            </Label>
            <Label variant="lg" tone="warning" style={styles.bombs}>
              {`BOMB x${s.bombCharges}`}
            </Label>
          </View>

          <Pressable
            accessibilityLabel="Pause"
            onPress={menuActions.onPauseOpen}
            style={styles.pauseBtn}
          >
            <Label variant="lg" tone="muted">
              ||
            </Label>
          </Pressable>

          {s.bossActive ? (
            <View style={styles.bossWrap} pointerEvents="none">
              <HUDBar
                label="BOSS"
                kind="hp"
                value={s.bossHp}
                max={s.bossHpMax}
                showNumbers={false}
              />
            </View>
          ) : null}

          <View style={styles.hpWrap} pointerEvents="none">
            <HUDBar
              label="HP"
              kind="hp"
              value={s.playerHp}
              max={s.playerHpMax}
              showNumbers={false}
            />
          </View>
        </>
      ) : null}

      <Pressable
        onLongPress={toggleShowFps}
        delayLongPress={400}
        style={styles.fpsHotspot}
        accessibilityLabel="Toggle FPS overlay"
      >
        {showFps && fpsLine ? (
          <Label variant="xs" tone="success" mono>
            {fpsLine}
          </Label>
        ) : null}
      </Pressable>

      {/* MAIN MENU */}
      <Modal
        visible={s.currentScene === 'menu' && s.menuReady && !ui.settingsOpen && !ui.slotPickerOpen}
      >
        <Pressable onPress={menuActions.onTitleTap} style={styles.titleHit}>
          <Label variant="xl" style={styles.title}>
            FLARE SHMUP
          </Label>
        </Pressable>
        <View style={styles.modalButtons}>
          <Button label="NEW GAME" variant="primary" onPress={menuActions.onNewGame} />
          {s.lastSlotIndex !== null && s.slots[s.lastSlotIndex] ? (
            <Button
              label={`CONTINUE — SLOT ${s.lastSlotIndex + 1}`}
              variant="secondary"
              onPress={menuActions.onContinue}
            />
          ) : null}
          <Button label="SETTINGS" variant="ghost" onPress={menuActions.onOpenSettings} />
        </View>
      </Modal>

      {/* SLOT PICKER */}
      <Modal visible={s.currentScene === 'menu' && ui.slotPickerOpen}>
        <Label variant="xl" style={styles.title}>
          PICK A SLOT
        </Label>
        <View style={styles.modalButtons}>
          {[0, 1, 2].map((i) => (
            <SlotRow
              key={i}
              index={i}
              slot={s.slots[i] ?? null}
              pending={ui.pendingResetSlot === i}
            />
          ))}
          <Button label="BACK" variant="ghost" onPress={menuActions.onCloseSettings} />
        </View>
      </Modal>

      {/* SETTINGS */}
      <Modal visible={ui.settingsOpen}>
        <Label variant="xl" style={styles.title}>
          SETTINGS
        </Label>
        <View style={styles.settingsCol}>
          <SettingRow
            label="SFX"
            value={s.settings.sfxVolume}
            onChange={(v) => settingsPatch({ sfxVolume: v })}
          />
          <SettingRow
            label="MUSIC"
            value={s.settings.musicVolume}
            onChange={(v) => settingsPatch({ musicVolume: v })}
          />
          <ToggleRow
            label="SCREEN SHAKE"
            value={s.settings.screenShake}
            onToggle={() => settingsPatch({ screenShake: !s.settings.screenShake })}
          />
        </View>
        <View style={styles.modalButtons}>
          <Button label="CLOSE" variant="primary" onPress={menuActions.onCloseSettings} />
        </View>
      </Modal>

      {/* BASE */}
      <Modal
        visible={
          s.currentScene === 'base' && s.menuReady && !ui.settingsOpen && ui.baseTile === null
        }
      >
        <Label variant="xl" style={styles.title}>
          HOME BASE
        </Label>
        <Label variant="sm" tone="muted" style={styles.subtitle}>
          {`SLOT ${(s.activeSlot ?? 0) + 1} · BEST ${s.slots[s.activeSlot ?? 0]?.bestScore ?? 0}`}
        </Label>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Button
                label="SHOP"
                variant="secondary"
                onPress={() => menuActions.onOpenBaseTile('shop')}
              />
            </View>
            <View style={styles.gridCell}>
              <Button
                label="INVENTORY"
                variant="secondary"
                onPress={() => menuActions.onOpenBaseTile('inventory')}
              />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Button
                label="SHIPS"
                variant="secondary"
                onPress={() => menuActions.onOpenBaseTile('ships')}
              />
            </View>
            <View style={styles.gridCell}>
              <Button
                label="SCORES"
                variant="secondary"
                onPress={() => menuActions.onOpenBaseTile('leaderboard')}
              />
            </View>
          </View>
        </View>
        <View style={styles.modalButtons}>
          <Button label="LAUNCH RUN" variant="primary" onPress={menuActions.onLaunchRun} />
          <Button label="SETTINGS" variant="ghost" onPress={menuActions.onOpenSettings} />
          <Button label="MAIN MENU" variant="ghost" onPress={menuActions.onBaseBack} />
        </View>
      </Modal>

      {/* BASE TILE MODAL */}
      <Modal visible={s.currentScene === 'base' && ui.baseTile !== null}>
        <Label variant="xl" style={styles.title}>
          {tileTitle(ui.baseTile)}
        </Label>
        {ui.baseTile === 'leaderboard' ? (
          <LeaderboardBody slots={s.slots} />
        ) : (
          <Label variant="sm" tone="muted" style={styles.subtitle}>
            Coming soon. This tile is a placeholder in the engine demo.
          </Label>
        )}
        <View style={styles.modalButtons}>
          <Button label="CLOSE" variant="primary" onPress={menuActions.onCloseBaseTile} />
        </View>
      </Modal>

      {/* DIALOGUE */}
      {s.currentScene === 'dialogue' && dialogue ? (
        <View style={styles.dialogueWrap} pointerEvents="box-none">
          <Pressable onPress={menuActions.onDialogueAdvance} style={styles.dialoguePressable}>
            <Panel>
              <Label variant="sm" tone="warning" style={styles.dialogueSpeaker}>
                {dialogue.speaker}
              </Label>
              <Label variant="md" style={styles.dialogueText}>
                {dialogue.text}
              </Label>
              <Label variant="xs" tone="muted" style={styles.dialogueHint}>
                Tap to continue
              </Label>
            </Panel>
          </Pressable>
        </View>
      ) : null}

      {/* PAUSE */}
      <Modal visible={inPlay && ui.pauseOpen && !ui.settingsOpen}>
        <Label variant="xl" style={styles.title}>
          PAUSED
        </Label>
        <View style={styles.modalButtons}>
          <Button label="RESUME" variant="primary" onPress={menuActions.onPauseResume} />
          <Button label="SETTINGS" variant="ghost" onPress={menuActions.onOpenSettings} />
          <Button label="MAIN MENU" variant="ghost" onPress={menuActions.onPauseToMenu} />
        </View>
      </Modal>

      {/* END SCREEN */}
      <Modal visible={isEnd && s.menuReady && !ui.settingsOpen}>
        <Label
          variant="xl"
          tone={s.currentScene === 'victory' ? 'success' : 'danger'}
          style={styles.title}
        >
          {s.currentScene === 'victory' ? 'VICTORY' : 'GAME OVER'}
        </Label>
        <EndSummary
          run={s.runStats}
          slot={s.activeSlot !== null ? (s.slots[s.activeSlot] ?? null) : null}
        />
        <View style={styles.modalButtons}>
          {s.currentScene === 'game-over' ? (
            <Button label="RETRY" variant="primary" onPress={menuActions.onEndRetry} />
          ) : null}
          <Button
            label={s.currentScene === 'victory' ? 'CONTINUE' : 'BACK TO BASE'}
            variant={s.currentScene === 'victory' ? 'primary' : 'secondary'}
            onPress={menuActions.onEndContinue}
          />
        </View>
      </Modal>
    </View>
  );
}

function SlotRow(props: {
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
}

function requestReset(i: number | null): void {
  // Lazy import avoids a circular file reference at module init.
  const m = require('./ui-state') as typeof import('./ui-state');
  m.requestResetSlot(i);
}

function SettingRow(props: {
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
}

function ToggleRow(props: {
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
}

function LeaderboardBody(props: {
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
}

function EndSummary(props: {
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
}

function SummaryRow(props: {
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
}

function tileTitle(tile: 'shop' | 'inventory' | 'ships' | 'leaderboard' | null): string {
  switch (tile) {
    case 'shop':
      return 'SHOP';
    case 'inventory':
      return 'INVENTORY';
    case 'ships':
      return 'SHIPS';
    case 'leaderboard':
      return 'SCORES';
    default:
      return '';
  }
}

function settingsPatch(patch: {
  sfxVolume?: number;
  musicVolume?: number;
  screenShake?: boolean;
}): void {
  const m = require('../save/ref') as typeof import('../save/ref');
  void m.getSaveStore().setSettings(patch);
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
  },
  topRow: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  score: { letterSpacing: 2, fontWeight: '700' },
  bombs: { letterSpacing: 2, fontWeight: '700' },
  pauseBtn: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fpsHotspot: {
    position: 'absolute',
    top: 52,
    left: 12,
    minWidth: 48,
    minHeight: 28,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'flex-start',
  },
  bossWrap: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
  },
  hpWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  title: { letterSpacing: 4, fontWeight: '800', textAlign: 'center' },
  subtitle: { letterSpacing: 2, marginTop: 8, textAlign: 'center' },
  titleHit: { paddingVertical: 8 },
  modalButtons: { marginTop: 20, alignItems: 'stretch', gap: 8 },
  grid: { marginTop: 16 },
  gridRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  gridCell: { flex: 1 },
  slotRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  slotMain: { flex: 1 },
  slotReset: { minWidth: 96 },
  settingsCol: { marginTop: 12, gap: 12 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  settingLabel: { letterSpacing: 2, fontWeight: '600', minWidth: 128 },
  settingButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingValue: { minWidth: 44, textAlign: 'center' },
  leaderWrap: { marginTop: 12, gap: 4 },
  leaderRow: { textAlign: 'left' },
  summaryWrap: { marginTop: 12, gap: 6 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogueWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
  },
  dialoguePressable: { width: '100%' },
  dialogueSpeaker: { letterSpacing: 2, fontWeight: '700' },
  dialogueText: { marginTop: 6, lineHeight: 22 },
  dialogueHint: { marginTop: 8, textAlign: 'right' },
});
