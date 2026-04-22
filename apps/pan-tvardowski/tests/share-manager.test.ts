import { describe, expect, test } from 'bun:test';
import type { NativeShareLike } from '@flare-engine/share';
import { createShareManager, shareHighScore } from '../src/share/manager';

function makeFakeShare(): {
  share: NativeShareLike;
  calls: Array<{ title?: string; message?: string; url?: string }>;
} {
  const calls: Array<{ title?: string; message?: string; url?: string }> = [];
  const share: NativeShareLike = {
    async share(content) {
      calls.push(content);
      return { action: 'sharedAction' };
    },
  };
  return { share, calls };
}

const t = (key: string, params?: Record<string, unknown>): string => {
  const templates: Record<string, string> = {
    'hud.share': 'Share',
    'hud.share.victory': 'Victory! Score {score}',
    'hud.share.gameover': 'Game over. Score {score}',
  };
  let out = templates[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) {
      out = out.replaceAll(`{${k}}`, String(params[k]));
    }
  }
  return out;
};

describe('share manager', () => {
  test('victory payload differs from game-over payload and URL is present', async () => {
    const { share, calls } = makeFakeShare();
    const manager = createShareManager(share);

    await shareHighScore({ manager, score: 1234, victory: true, t });
    await shareHighScore({ manager, score: 1234, victory: false, t });

    expect(calls.length).toBe(2);
    const victory = calls[0]!;
    const gameover = calls[1]!;
    expect(victory.message).not.toBe(gameover.message);
    expect(victory.message).toContain('1234');
    expect(gameover.message).toContain('1234');
    expect(victory.url).toBe('https://flare-engine.dev');
    expect(gameover.url).toBe('https://flare-engine.dev');
  });

  test('uses hud.share for the title and distinct keys for victory vs gameover', async () => {
    const { share, calls } = makeFakeShare();
    const manager = createShareManager(share);
    await shareHighScore({ manager, score: 42, victory: true, t });
    const first = calls[0]!;
    expect(first.title).toBe('Share');
    expect(first.message).toBe('Victory! Score 42');
  });
});
