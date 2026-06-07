import { Position } from '@flare-engine/engine';
import type { GameContextValue } from '@flare-engine/engine';
import { CollisionWorld } from '@flare-engine/physics';
import { setZoneMusic } from '../../audio/init';
import { createZoneBg } from '../../bg/create-zone-bg';
import { PLAYER_HP_MAX, START_BOMBS } from '../../config/gameplay';
import type { ZoneConfig } from '../../config/zones';
import { createOpeningGraph, createZone7EntryGraph, createZone8IntroGraph } from '../../dialogue';
import type { ZoneId } from '../../events';
import { gameEvents } from '../../events';
import { resetCataclysmGate } from '../../fx/explosions';
import type { PanPostFxController } from '../../fx/postfx';
import { showZoneBanner } from '../../hud/zone-banner';
import type { AtlasHandle } from '../../spawn';
import { spawnPlayer } from '../../spawn';
import { createRunStats, gameState, notifyStateChanged } from '../../state';
import { clearBossFsms } from '../../systems/boss';
import { destroyEntity } from '../../systems/entity-ops';
import { clearMinibossFsms } from '../../systems/miniboss';
import { ZONE_FX_DEFS } from '../../visual-spec';
import type { AudioRef, PlaySceneDeps } from '../play';
import { initState } from './state';
import type { PlayState } from './types';

export function clearWorld(state: PlayState, ctx: GameContextValue): void {
  if (state.zoneBg) {
    state.zoneBg.destroy();
    state.zoneBg = null;
  }
  const ids: number[] = [];
  for (const id of state.posQuery) ids.push(id);
  for (const id of ids) destroyEntity(ctx.world, state.coll, id);
  state.coll = new CollisionWorld();
  state.spawnCtx.coll = state.coll;
}

export function refreshBounds(
  state: PlayState,
  ctx: GameContextValue,
  getBottomInset: () => number,
): void {
  const vw = ctx.camera.viewportWidth;
  const vh = ctx.camera.viewportHeight;
  const hasViewport = vw > 0 && vh > 0;
  const prevW = state.bounds.width;
  state.bounds.width = hasViewport ? vw : 360;
  // Subtract the safe-area bottom inset so gameplay logic (player clamp,
  // spawn Y, entity cull) never uses the occluded region. The canvas and
  // camera remain full-bleed — only the logical play-area is reduced.
  state.bounds.height = (hasViewport ? vh : 640) - getBottomInset();
  // Keep the camera centered on the current viewport so the world isn't
  // offset when the real device layout arrives after the scene mounts.
  ctx.camera.x = state.bounds.width / 2;
  ctx.camera.y = state.bounds.height / 2;
  // First real layout: re-anchor entities that were placed against the
  // fallback 360-wide bounds so they sit on the new viewport midline.
  if (hasViewport && !state.viewportReady) {
    state.viewportReady = true;
    const dx = state.bounds.width / 2 - prevW / 2;
    if (dx !== 0) {
      const recenter = (id: number): void => {
        if (id < 0) return;
        const p = ctx.world.get(id, Position);
        if (p) p.x += dx;
      };
      recenter(state.playerId);
      recenter(state.bossId);
      recenter(state.minibossId);
    }
  }
}

export function setupZoneHud(zone: ZoneConfig): void {
  gameState.currentZone = zone.id;
  gameState.bossNameKey = zone.bossNameKey;
  gameState.minibossNameKey =
    zone.minibossPattern !== null ? `minibosses.${zone.minibossPattern}.name` : '';
  const zoneNum = zone.id.slice(1); // 'z1' → '1', 'z3' → '3'
  gameState.zoneBanner.nameKey = `zones.${zoneNum}.name`;
  gameState.zoneBanner.subtitleKey = `zones.${zoneNum}.subtitle`;
}

export function startZone(
  zoneId: ZoneId,
  fullReset: boolean,
  sBox: { s: PlayState | null },
  ctx: GameContextValue,
  atlas: AtlasHandle,
  deps: PlaySceneDeps,
  audioRef: AudioRef | undefined,
  getBottomInset: () => number,
  postfx: PanPostFxController,
): void {
  resetCataclysmGate(zoneId);
  if (sBox.s) {
    clearWorld(sBox.s, ctx);
  }
  clearBossFsms();
  clearMinibossFsms();
  sBox.s = initState(zoneId, ctx, atlas, deps, audioRef);
  const s = sBox.s;

  if (fullReset) {
    gameState.playerHp = PLAYER_HP_MAX;
    gameState.playerHpMax = PLAYER_HP_MAX;
    gameState.score = 0;
    gameState.bombCharges = START_BOMBS;
    gameState.runStats = createRunStats();
  }
  gameState.bossActive = false;
  gameState.bossHp = 0;
  gameState.bossHpMax = 0;
  gameState.minibossActive = false;
  gameState.minibossHp = 0;
  gameState.minibossHpMax = 0;
  gameState.comboCount = 0;
  gameState.comboHit = false;
  gameState.gameOver = false;
  gameState.victory = false;
  gameState.currentScene = 'play';
  setupZoneHud(s.zone);
  showZoneBanner(s.banner);
  gameState.zoneBanner.visible = true;
  gameState.zoneBanner.opacity = 0;
  notifyStateChanged();

  refreshBounds(s, ctx, getBottomInset);
  ctx.camera.x = s.bounds.width / 2;
  ctx.camera.y = s.bounds.height / 2;
  ctx.camera.zoom = 1;
  ctx.camera.rotation = 0;
  s.playerId = spawnPlayer(s.spawnCtx, s.bounds.width / 2, s.bounds.height - 90);

  s.zoneBg = createZoneBg(zoneId, {
    world: ctx.world,
    atlas,
    kenney: deps.kenney ?? null,
    bg: deps.bg ?? null,
    viewportWidth: s.bounds.width,
    viewportHeight: s.bounds.height,
    camera: ctx.camera,
  });

  postfx.setCrtEnabled(zoneId === 'z8');
  const zoneNum = Number(zoneId.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  postfx.setZoneFxDef(ZONE_FX_DEFS[zoneNum]);
  setZoneMusic(audioRef?.current?.music ?? null, s.zone.music);
  gameEvents.emit('zone-start', zoneId);

  // M7: play the zone-entry dialogue (if any) before the first wave spawns.
  // The dialogue controller sets gameState.dialogue; the main update loop
  // treats that as a hard pause gate.
  const dlg = deps.dialogue;
  if (dlg && zoneId === 'z1' && !deps.save.introSeen()) {
    dlg.play(createOpeningGraph(), () => {
      void deps.save.markIntroSeen();
    });
  } else if (dlg && zoneId === 'z7') {
    dlg.play(createZone7EntryGraph());
  } else if (dlg && zoneId === 'z8') {
    dlg.play(createZone8IntroGraph());
  }

  void deps.save.persist();
}
