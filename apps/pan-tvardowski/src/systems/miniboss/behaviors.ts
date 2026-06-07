import { Position } from '@flare-engine/ecs';
import { Vec2 as V, clamp } from '@flare-engine/math';
import { type LeszyForm, Miniboss, type MinibossPattern } from '../../components';
import {
  BULLET_SPAWN_OFFSET,
  BULLET_SPEED,
  LESZY_FORM_SEC,
  MADEJ_SPIKE_SEC,
  NOCNY_LOWCA_HOUND_COUNT,
} from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { BOSS_LAYOUT_DEFS } from '../../visual-spec/boss-layouts';
import { MINIBOSS_TUNING_DEFS } from '../../visual-spec/boss-tuning';
import { fireAimedFan } from '../fire-helpers';
import { aim, sweepMove } from './shared';
import type { MinibossBehavior, MinibossCtx } from './types';

const _rokita = MINIBOSS_TUNING_DEFS.rokita;
const _leszy = MINIBOSS_TUNING_DEFS.leszy;
const _nocnyLowca = MINIBOSS_TUNING_DEFS['nocny-lowca'];
const _madej = MINIBOSS_TUNING_DEFS.madej;

/** Time to reach full root extent (Rokita). */
const ROKITA_ROOT_GROW_SEC = 25;

/** Rokita seed-shot — aimed, from one of the two advancing root tips. */
function rokitaFire(c: MinibossCtx): void {
  const pos = c.world.get(c.id, Position);
  const m = c.world.get(c.id, Miniboss);
  if (!pos || !m) return;
  const corridor = Math.max(40, c.deps.bounds.width * (0.5 - 0.45 * m.rootProgress));
  const leftTip = c.deps.bounds.width / 2 - corridor;
  const rightTip = c.deps.bounds.width / 2 + corridor;
  const yTip = c.deps.bounds.height * 0.55;
  for (const tipX of [leftTip, rightTip]) {
    V.normalizeOut(c.deps.playerX - tipX, c.deps.playerY - yTip, BULLET_SPEED.enemy, aim);
    spawnBullet(c.deps.spawnCtx, tipX, yTip, aim.x, aim.y, Layer.enemy);
  }
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  spawnBullet(c.deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.boss, aim.x, aim.y, Layer.enemy);
}

/** Leszy fires per-form: deer=ram downward, bear=slow AOE single big bullet,
 *  owl=radial 8-way burst. Returns the next fire cooldown in seconds. */
function leszyFire(c: MinibossCtx): number {
  const pos = c.world.get(c.id, Position);
  const m = c.world.get(c.id, Miniboss);
  if (!pos || !m) return 1;
  if (_leszy.kind !== 'leszy') return 1;
  const ox = pos.x;
  const oy = pos.y + BULLET_SPAWN_OFFSET.boss;
  if (m.form === 'deer') {
    fireAimedFan(c, 3, 0.14);
    return _leszy.fireCooldownDeerSec;
  }
  if (m.form === 'bear') {
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss * 0.55, aim);
    spawnBullet(c.deps.spawnCtx, ox, oy, aim.x, aim.y, Layer.enemy);
    return _leszy.fireCooldownBearSec;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawnBullet(
      c.deps.spawnCtx,
      ox,
      oy,
      Math.cos(a) * BULLET_SPEED.enemy,
      Math.sin(a) * BULLET_SPEED.enemy,
      Layer.enemy,
    );
  }
  return _leszy.fireCooldownOwlSec;
}

const FORM_ORDER: readonly LeszyForm[] = ['deer', 'bear', 'owl'];
function nextLeszyForm(current: LeszyForm): LeszyForm {
  const idx = FORM_ORDER.indexOf(current);
  return FORM_ORDER[(idx + 1) % FORM_ORDER.length] ?? 'deer';
}

/** Nocny Łowca fires an aimed pair whip-shot while the hounds do the chasing. */
function nocnyLowcaFire(c: MinibossCtx): number {
  const pos = c.world.get(c.id, Position);
  if (!pos) return 1;
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  const base = Math.atan2(aim.y, aim.x);
  for (let i = -1; i <= 1; i += 2) {
    const a = base + i * 0.18;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      Math.cos(a) * BULLET_SPEED.boss,
      Math.sin(a) * BULLET_SPEED.boss,
      Layer.enemy,
    );
  }
  return _nocnyLowca.kind === 'simple' ? _nocnyLowca.fireCooldownSec : 0.9;
}

/** Madej: aimed heavy shot paired with a spike-lane drop on fixed cadence. */
function madejFire(c: MinibossCtx): number {
  const cd = _madej.kind === 'simple' ? _madej.fireCooldownSec : 1.1;
  fireAimedFan(c, 3, 0.22);
  return cd;
}

/** Madej: drop a persistent spike column in lane (spikeIndex % 3). */
function madejSpike(c: MinibossCtx): void {
  const m = c.world.get(c.id, Miniboss);
  if (!m || !c.deps.onSpawnSpikeLane) return;
  const laneIdx = m.spikeIndex % 3;
  const laneW = c.deps.bounds.width / 3;
  const laneX = laneW * (0.5 + laneIdx);
  c.deps.onSpawnSpikeLane(laneX);
  m.spikeIndex += 1;
}

const NOCNY_LOWCA_LAYOUT = BOSS_LAYOUT_DEFS.find((d) => d.id === 'nocny-lowca');
const NOCNY_LOWCA_HOUND_SUMMON = NOCNY_LOWCA_LAYOUT?.summons?.[0];

/** Summon `NOCNY_LOWCA_HOUND_COUNT` hounds arcing around the miniboss. */
function summonHounds(c: MinibossCtx): void {
  const pos = c.world.get(c.id, Position);
  const m = c.world.get(c.id, Miniboss);
  if (!pos || !m || !c.deps.onSpawnHound) return;
  const ox = NOCNY_LOWCA_HOUND_SUMMON?.ox ?? 46;
  const oy = NOCNY_LOWCA_HOUND_SUMMON?.oy ?? 30;
  const origin = NOCNY_LOWCA_HOUND_SUMMON?.origin;
  const half = (NOCNY_LOWCA_HOUND_COUNT - 1) / 2;
  for (let i = 0; i < NOCNY_LOWCA_HOUND_COUNT; i++) {
    const offset = (i - half) * ox;
    let spawnX: number;
    let spawnY: number;
    if (origin === 'screen-bottom') {
      spawnX = pos.x + offset;
      spawnY = c.deps.bounds.height + oy;
    } else {
      spawnX = pos.x + offset;
      spawnY = pos.y + oy;
    }
    c.deps.onSpawnHound(spawnX, spawnY);
  }
  m.hounds = NOCNY_LOWCA_HOUND_COUNT;
}

export const MINIBOSS_BEHAVIORS: Record<MinibossPattern, MinibossBehavior> = {
  rokita: {
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      if (!m) return;
      m.rootProgress = clamp(m.phaseT / ROKITA_ROOT_GROW_SEC, 0, 1);
      sweepMove(c, _rokita.kind === 'simple' ? _rokita.sweepSpeed : 55);
      m.fireCooldown -= dt;
      if (m.fireCooldown <= 0) {
        rokitaFire(c);
        m.fireCooldown = _rokita.kind === 'simple' ? _rokita.fireCooldownSec : 1.1;
      }
    },
  },

  leszy: {
    onActiveEnter(c) {
      const m2 = c.world.get(c.id, Miniboss);
      if (m2) c.deps.onFormChange?.(m2.form);
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      if (!m) return;
      m.formT += dt;
      if (m.formT >= LESZY_FORM_SEC) {
        m.formT -= LESZY_FORM_SEC;
        m.form = nextLeszyForm(m.form);
        c.deps.onFormChange?.(m.form);
      }
      const speed =
        _leszy.kind === 'leszy'
          ? m.form === 'deer'
            ? _leszy.sweepSpeedDeer
            : m.form === 'bear'
              ? _leszy.sweepSpeedBear
              : _leszy.sweepSpeedOwl
          : m.form === 'deer'
            ? 95
            : m.form === 'bear'
              ? 35
              : 130;
      sweepMove(c, speed);
      m.fireCooldown -= dt;
      if (m.fireCooldown <= 0) {
        m.fireCooldown = leszyFire(c);
      }
    },
  },

  'nocny-lowca': {
    onActiveEnter(c) {
      summonHounds(c);
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      if (!m) return;
      sweepMove(c, _nocnyLowca.kind === 'simple' ? _nocnyLowca.sweepSpeed : 120);
      const live = c.deps.countHounds?.() ?? m.hounds;
      m.hounds = live;
      if (live === 0) summonHounds(c);
      m.fireCooldown -= dt;
      if (m.fireCooldown <= 0) {
        m.fireCooldown = nocnyLowcaFire(c);
      }
    },
  },

  madej: {
    onActiveEnter(c) {
      const m2 = c.world.get(c.id, Miniboss);
      if (m2) {
        m2.formT = MADEJ_SPIKE_SEC * 0.6;
        m2.spikeIndex = 0;
      }
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      if (!m) return;
      sweepMove(c, _madej.kind === 'simple' ? _madej.sweepSpeed : 50);
      m.formT += dt;
      if (m.formT >= MADEJ_SPIKE_SEC) {
        m.formT -= MADEJ_SPIKE_SEC;
        madejSpike(c);
      }
      m.fireCooldown -= dt;
      if (m.fireCooldown <= 0) {
        m.fireCooldown = madejFire(c);
      }
    },
  },
};
