import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  addAnimation,
  getFrame,
  parseAseprite,
  parseTexturePackerArray,
  parseTexturePackerHash,
} from '../src/sprite-sheet.js';

const g = globalThis as Record<string, unknown>;

afterEach(() => {
  g.__DEV__ = undefined;
});

describe('SpriteSheet', () => {
  describe('parseTexturePackerHash', () => {
    it('parses hash format frames', () => {
      const json = {
        frames: {
          'player_0.png': { frame: { x: 0, y: 0, w: 32, h: 32 } },
          'player_1.png': { frame: { x: 32, y: 0, w: 32, h: 32 } },
        },
      };
      const sheet = parseTexturePackerHash(json);
      expect(sheet.frames).toHaveLength(2);
      expect(sheet.frames[0]?.name).toBe('player_0.png');
      expect(sheet.frames[0]?.x).toBe(0);
      expect(sheet.frames[1]?.name).toBe('player_1.png');
      expect(sheet.frames[1]?.x).toBe(32);
      expect(sheet.frameMap.get('player_0.png')).toBe(0);
      expect(sheet.frameMap.get('player_1.png')).toBe(1);
    });

    it('handles empty frames', () => {
      const sheet = parseTexturePackerHash({ frames: {} });
      expect(sheet.frames).toHaveLength(0);
    });
  });

  describe('parseTexturePackerArray', () => {
    it('parses array format frames', () => {
      const json = {
        frames: [
          {
            filename: 'enemy_0.png',
            frame: { x: 0, y: 0, w: 64, h: 64 },
          },
          {
            filename: 'enemy_1.png',
            frame: { x: 64, y: 0, w: 64, h: 64 },
          },
        ],
      };
      const sheet = parseTexturePackerArray(json);
      expect(sheet.frames).toHaveLength(2);
      expect(sheet.frames[0]?.name).toBe('enemy_0.png');
      expect(sheet.frames[0]?.w).toBe(64);
      expect(sheet.frameMap.get('enemy_1.png')).toBe(1);
    });

    it('handles empty array', () => {
      const sheet = parseTexturePackerArray({ frames: [] });
      expect(sheet.frames).toHaveLength(0);
    });
  });

  describe('parseAseprite', () => {
    it('parses Aseprite array format', () => {
      const json = {
        frames: [
          {
            filename: 'walk_0',
            frame: { x: 0, y: 0, w: 16, h: 16 },
            duration: 100,
          },
          {
            filename: 'walk_1',
            frame: { x: 16, y: 0, w: 16, h: 16 },
            duration: 100,
          },
          {
            filename: 'walk_2',
            frame: { x: 32, y: 0, w: 16, h: 16 },
            duration: 100,
          },
        ],
        meta: {
          frameTags: [{ name: 'walk', from: 0, to: 2, direction: 'forward' }],
        },
      };
      const sheet = parseAseprite(json);
      expect(sheet.frames).toHaveLength(3);
      expect(sheet.animations.has('walk')).toBe(true);
      const walk = sheet.animations.get('walk')!;
      expect(walk.frameIndices).toEqual([0, 1, 2]);
      expect(walk.frameDuration).toBeCloseTo(0.1);
      expect(walk.loop).toBe(true);
    });

    it('parses Aseprite object format (legacy)', () => {
      const json = {
        frames: {
          idle_0: {
            filename: 'idle_0',
            frame: { x: 0, y: 0, w: 16, h: 16 },
            duration: 200,
          },
        },
      };
      const sheet = parseAseprite(json);
      expect(sheet.frames).toHaveLength(1);
      expect(sheet.frames[0]?.name).toBe('idle_0');
    });

    it('handles reverse direction tag', () => {
      const json = {
        frames: [
          {
            filename: 'f0',
            frame: { x: 0, y: 0, w: 8, h: 8 },
            duration: 50,
          },
          {
            filename: 'f1',
            frame: { x: 8, y: 0, w: 8, h: 8 },
            duration: 50,
          },
          {
            filename: 'f2',
            frame: { x: 16, y: 0, w: 8, h: 8 },
            duration: 50,
          },
        ],
        meta: {
          frameTags: [{ name: 'rev', from: 0, to: 2, direction: 'reverse' }],
        },
      };
      const sheet = parseAseprite(json);
      const rev = sheet.animations.get('rev')!;
      expect(rev.frameIndices).toEqual([2, 1, 0]);
    });

    it('handles pingpong direction tag', () => {
      const json = {
        frames: [
          {
            filename: 'f0',
            frame: { x: 0, y: 0, w: 8, h: 8 },
            duration: 50,
          },
          {
            filename: 'f1',
            frame: { x: 8, y: 0, w: 8, h: 8 },
            duration: 50,
          },
          {
            filename: 'f2',
            frame: { x: 16, y: 0, w: 8, h: 8 },
            duration: 50,
          },
        ],
        meta: {
          frameTags: [
            {
              name: 'bounce',
              from: 0,
              to: 2,
              direction: 'pingpong',
            },
          ],
        },
      };
      const sheet = parseAseprite(json);
      const bounce = sheet.animations.get('bounce')!;
      // 0,1,2,1 (forward then reverse, excluding endpoints)
      expect(bounce.frameIndices).toEqual([0, 1, 2, 1]);
    });

    it('works without frameTags', () => {
      const json = {
        frames: [
          {
            filename: 'f0',
            frame: { x: 0, y: 0, w: 8, h: 8 },
            duration: 100,
          },
        ],
      };
      const sheet = parseAseprite(json);
      expect(sheet.frames).toHaveLength(1);
      expect(sheet.animations.size).toBe(0);
    });
  });

  describe('addAnimation', () => {
    it('adds a custom animation', () => {
      const json = {
        frames: {
          'a.png': { frame: { x: 0, y: 0, w: 16, h: 16 } },
          'b.png': { frame: { x: 16, y: 0, w: 16, h: 16 } },
        },
      };
      const sheet = parseTexturePackerHash(json);
      addAnimation(sheet, 'custom', [1, 0, 1], 0.2, false);
      const anim = sheet.animations.get('custom')!;
      expect(anim.frameIndices).toEqual([1, 0, 1]);
      expect(anim.frameDuration).toBe(0.2);
      expect(anim.loop).toBe(false);
    });
  });

  describe('getFrame', () => {
    it('returns frame by name', () => {
      const json = {
        frames: {
          'hero.png': { frame: { x: 10, y: 20, w: 30, h: 40 } },
        },
      };
      const sheet = parseTexturePackerHash(json);
      const frame = getFrame(sheet, 'hero.png');
      expect(frame).toEqual({
        name: 'hero.png',
        x: 10,
        y: 20,
        w: 30,
        h: 40,
      });
    });

    it('returns undefined for missing frame', () => {
      const json = { frames: {} };
      const sheet = parseTexturePackerHash(json);
      expect(getFrame(sheet, 'missing')).toBeUndefined();
    });
  });

  describe('rotated-frame dev warning', () => {
    it('warns naming a rotated hash frame when __DEV__ is on', () => {
      g.__DEV__ = true;
      const warn = spyOn(console, 'warn').mockImplementation(() => {});

      const sheet = parseTexturePackerHash({
        frames: { 'r.png': { frame: { x: 0, y: 0, w: 8, h: 8 }, rotated: true } },
      });

      expect(warn).toHaveBeenCalledTimes(1);
      const msg = String(warn.mock.calls[0]?.[0]);
      expect(msg).toContain('r.png');
      expect(msg).toContain('rotation');
      // Frame still parses (renders sideways, but is not dropped).
      expect(sheet.frames).toHaveLength(1);
      warn.mockRestore();
    });

    it('warns naming a rotated array frame when __DEV__ is on', () => {
      g.__DEV__ = true;
      const warn = spyOn(console, 'warn').mockImplementation(() => {});

      parseTexturePackerArray({
        frames: [{ filename: 'a.png', frame: { x: 0, y: 0, w: 8, h: 8 }, rotated: true }],
      });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('a.png');
      warn.mockRestore();
    });

    it('is silent when __DEV__ is unset', () => {
      g.__DEV__ = undefined;
      const warn = spyOn(console, 'warn').mockImplementation(() => {});

      parseTexturePackerHash({
        frames: { 'r.png': { frame: { x: 0, y: 0, w: 8, h: 8 }, rotated: true } },
      });

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn for non-rotated frames even when __DEV__ is on', () => {
      g.__DEV__ = true;
      const warn = spyOn(console, 'warn').mockImplementation(() => {});

      parseTexturePackerHash({
        frames: { 'ok.png': { frame: { x: 0, y: 0, w: 8, h: 8 } } },
      });

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
