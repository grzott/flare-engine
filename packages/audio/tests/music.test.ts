import { describe, expect, it } from 'bun:test';
import type { AudioBufferLike, AudioContextLike, GainNodeLike } from '../src/audio-manager.js';
import { Music } from '../src/music.js';

function mockBuffer(): AudioBufferLike {
  return {
    duration: 60,
    numberOfChannels: 2,
    sampleRate: 44100,
    length: 44100 * 60,
  };
}

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

describe('Music', () => {
  it('starts with nothing playing', () => {
    const music = new Music();
    expect(music.playing).toBeNull();
  });

  it('plays a registered track', () => {
    const music = new Music();
    music.connect(mockAudioContext(), mockGainNode());
    music.register('bgm', mockBuffer());
    music.play('bgm');
    expect(music.playing).toBe('bgm');
  });

  it('ignores play when not connected', () => {
    const music = new Music();
    music.register('bgm', mockBuffer());
    music.play('bgm');
    expect(music.playing).toBeNull();
  });

  it('ignores play of unregistered track', () => {
    const music = new Music();
    music.connect(mockAudioContext(), mockGainNode());
    music.play('nonexistent');
    expect(music.playing).toBeNull();
  });

  it('stops the current track', () => {
    const music = new Music();
    music.connect(mockAudioContext(), mockGainNode());
    music.register('bgm', mockBuffer());
    music.play('bgm');
    music.stop();
    expect(music.playing).toBeNull();
  });

  it('switches track on play (stops previous)', () => {
    const music = new Music();
    music.connect(mockAudioContext(), mockGainNode());
    music.register('bgm1', mockBuffer());
    music.register('bgm2', mockBuffer());
    music.play('bgm1');
    expect(music.playing).toBe('bgm1');
    music.play('bgm2');
    expect(music.playing).toBe('bgm2');
  });

  it('crossfadeTo switches tracks', () => {
    const music = new Music();
    music.connect(mockAudioContext(), mockGainNode());
    music.register('bgm1', mockBuffer());
    music.register('bgm2', mockBuffer());
    music.play('bgm1');
    music.crossfadeTo('bgm2', 2);
    expect(music.playing).toBe('bgm2');
  });

  it('crossfadeTo from nothing just starts the track', () => {
    const music = new Music();
    music.connect(mockAudioContext(), mockGainNode());
    music.register('bgm', mockBuffer());
    music.crossfadeTo('bgm', 1);
    expect(music.playing).toBe('bgm');
  });

  it('stop is no-op when nothing playing', () => {
    const music = new Music();
    music.stop(); // Should not throw
    expect(music.playing).toBeNull();
  });
});
