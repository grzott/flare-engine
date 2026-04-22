import { describe, expect, test } from 'bun:test';
import { playSfx, resetSfxThrottle, setZoneMusic } from '../src/audio/sfx';
import { bombButtonState, gameState, joystickState, resetGameState } from '../src/state';

describe('state reset', () => {
  test('resetGameState restores first-boot defaults and preserves settings', () => {
    gameState.score = 9999;
    gameState.bossActive = true;
    gameState.bossHp = 123;
    gameState.gameOver = true;
    gameState.victory = true;
    gameState.currentScene = 'victory';
    gameState.currentZone = 'z5';
    gameState.zoneBanner.visible = true;
    gameState.zoneBanner.opacity = 1;
    gameState.settings.locale = 'pl';
    gameState.settings.reducedMotion = true;
    joystickState.dx = 0.8;
    joystickState.dy = -0.4;
    joystickState.active = true;
    bombButtonState.justPressed = true;
    bombButtonState.isPressed = true;

    resetGameState();

    expect(gameState.score).toBe(0);
    expect(gameState.bossActive).toBe(false);
    expect(gameState.bossHp).toBe(0);
    expect(gameState.gameOver).toBe(false);
    expect(gameState.victory).toBe(false);
    expect(gameState.currentScene as string).toBe('boot');
    expect(gameState.currentZone as string).toBe('z1');
    expect(gameState.zoneBanner.visible).toBe(false);
    expect(gameState.zoneBanner.opacity).toBe(0);
    // settings preserved
    expect(gameState.settings.locale).toBe('pl');
    expect(gameState.settings.reducedMotion).toBe(true);
    expect(joystickState.active).toBe(false);
    expect(joystickState.dx).toBe(0);
    expect(bombButtonState.justPressed).toBe(false);
    expect(bombButtonState.isPressed).toBe(false);
  });
});

describe('SFX throttle', () => {
  test('playSfx drops calls within the min-gap window', () => {
    resetSfxThrottle();
    let plays = 0;
    const pool = {
      play: (_key: string) => {
        plays++;
      },
    } as unknown as { play: (k: string) => void };
    const handles = { pool, music: {}, channels: {} } as unknown as Parameters<typeof playSfx>[0];
    for (let i = 0; i < 100; i++) playSfx(handles, 'shoot');
    // 30 ms gap — 100 synchronous calls must collapse to a single play.
    expect(plays).toBe(1);
  });

  test('playSfx is a no-op for null handles', () => {
    // Should not throw.
    playSfx(null, 'shoot');
    playSfx(undefined, 'shoot');
  });
});

describe('setZoneMusic guard', () => {
  test('no-op when same track already playing', () => {
    const calls: string[] = [];
    const music = {
      playing: 'zone3',
      play: (name: string) => {
        calls.push(`play:${name}`);
      },
      crossfadeTo: (name: string) => {
        calls.push(`xfade:${name}`);
      },
    } as unknown as Parameters<typeof setZoneMusic>[0];
    setZoneMusic(music, 'zone3');
    expect(calls).toEqual([]);
  });

  test('plays directly when nothing is playing', () => {
    const calls: string[] = [];
    const music = {
      playing: null as string | null,
      play: (name: string) => {
        calls.push(`play:${name}`);
      },
      crossfadeTo: (name: string) => {
        calls.push(`xfade:${name}`);
      },
    } as unknown as Parameters<typeof setZoneMusic>[0];
    setZoneMusic(music, 'zone1');
    expect(calls).toEqual(['play:zone1']);
  });

  test('crossfades when switching tracks', () => {
    const calls: string[] = [];
    const music = {
      playing: 'zone1',
      play: (name: string) => {
        calls.push(`play:${name}`);
      },
      crossfadeTo: (name: string) => {
        calls.push(`xfade:${name}`);
      },
    } as unknown as Parameters<typeof setZoneMusic>[0];
    setZoneMusic(music, 'zone2');
    expect(calls).toEqual(['xfade:zone2']);
  });
});
