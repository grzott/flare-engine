import { describe, expect, it } from 'bun:test';
import type { AudioContextLike, GainNodeLike } from '../src/audio-manager.js';
import { createChannels } from '../src/channels.js';

function mockGainNode(): GainNodeLike {
  return {
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
    connect() {},
    disconnect() {},
  };
}

function mockAudioContext(): AudioContextLike {
  return {
    state: 'running',
    currentTime: 0,
    destination: { channelCount: 2 },
    createGain: mockGainNode,
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        onended: null,
      };
    },
    async resume() {},
    async suspend() {},
    async close() {},
  };
}

describe('Channels', () => {
  it('creates master, sfx, music channels', () => {
    const ch = createChannels(mockAudioContext());
    expect(ch.has('master')).toBe(true);
    expect(ch.has('sfx')).toBe(true);
    expect(ch.has('music')).toBe(true);
    expect(ch.size).toBe(3);
  });

  it('channels start at volume 1', () => {
    const ch = createChannels(mockAudioContext());
    expect(ch.get('master')!.volume).toBe(1);
    expect(ch.get('sfx')!.volume).toBe(1);
    expect(ch.get('music')!.volume).toBe(1);
  });

  it('sets volume with clamping', () => {
    const ch = createChannels(mockAudioContext());
    const sfx = ch.get('sfx')!;
    sfx.volume = 0.5;
    expect(sfx.volume).toBe(0.5);

    sfx.volume = -1;
    expect(sfx.volume).toBe(0);

    sfx.volume = 2;
    expect(sfx.volume).toBe(1);
  });

  it('volume setter updates the gain node', () => {
    const ch = createChannels(mockAudioContext());
    const music = ch.get('music')!;
    music.volume = 0.3;
    expect(music.node.gain.value).toBeCloseTo(0.3, 5);
  });
});
