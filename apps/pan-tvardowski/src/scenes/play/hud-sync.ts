import { updateTween } from '@flare-engine/animation';
import type { GameContextValue } from '@flare-engine/engine';
import { Sprite } from '@flare-engine/render';
import { Boss } from '../../components';
import { gameState, notifyStateChanged } from '../../state';
import { computeBossStatus } from '../../systems/boss';
import { computeMinibossStatus } from '../../systems/miniboss';
import type { PlayState } from './types';

export function syncHudState(s: PlayState, ctx: GameContextValue, dt: number): void {
  // Advance HUD opacity/scale tweens and publish changes.
  if (!s.bossBarTween.done) {
    const nextOpacity = updateTween(s.bossBarTween, dt);
    if (Math.abs(gameState.bossBarOpacity - nextOpacity) > 0.01) {
      gameState.bossBarOpacity = nextOpacity;
      notifyStateChanged();
    }
  }
  if (!s.gameOverTween.done) {
    const nextGameOver = updateTween(s.gameOverTween, dt);
    if (Math.abs(gameState.gameOverOpacity - nextGameOver) > 0.01) {
      gameState.gameOverOpacity = nextGameOver;
      notifyStateChanged();
    }
  }
  if (!s.comboPulseTween.done) {
    const nextScale = updateTween(s.comboPulseTween, dt);
    if (Math.abs(gameState.comboPulseScale - nextScale) > 0.01) {
      gameState.comboPulseScale = nextScale;
      notifyStateChanged();
    }
  }

  // Tier-V cataclysm slow-mo: tick on rawDt so the ramp itself is unscaled.
  {
    const rawDt = ctx.loop.clock.rawDt;
    if (!s.slowDownTween.done) {
      ctx.loop.clock.timescale = updateTween(s.slowDownTween, rawDt);
    } else if (!s.recoveryTween.done) {
      ctx.loop.clock.timescale = updateTween(s.recoveryTween, rawDt);
    }
  }

  // Keep player sprite at constant full opacity — no sigil pulse.
  {
    const playerSprite = ctx.world.get(s.playerId, Sprite);
    if (playerSprite) playerSprite.alpha = 1.0;
  }

  // Publish bomb flash alpha to gameState for white-flash HUD overlay.
  {
    const nextFlash = s.flash.alpha * 0.6;
    if (Math.abs(gameState.bombFlashAlpha - nextFlash) > 0.01) {
      gameState.bombFlashAlpha = nextFlash;
      notifyStateChanged();
    }
  }

  // Publish boss status to HUD state.
  const status = computeBossStatus(ctx.world, s.bossQuery);
  gameState.bossActive = status.alive;
  gameState.bossHp = status.hp;
  gameState.bossHpMax = status.hpMax;
  // Publish Wodnik shield state for HUD + collision gating.
  let shieldActive = false;
  for (const bid of s.bossQuery) {
    const b = ctx.world.get(bid, Boss);
    if (b) {
      shieldActive = b.shieldActive;
      break;
    }
  }
  if (gameState.bossShieldActive !== shieldActive) {
    gameState.bossShieldActive = shieldActive;
    notifyStateChanged();
  }
  const mbStatus = computeMinibossStatus(ctx.world, s.minibossQuery);
  gameState.minibossActive = mbStatus.alive;
  gameState.minibossHp = mbStatus.hp;
  gameState.minibossHpMax = mbStatus.hpMax;
}
