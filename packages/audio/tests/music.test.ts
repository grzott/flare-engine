import { describe, expect, it } from 'bun:test';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  GainNodeLike,
} from '../src/audio-manager.js';
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

/** react-native-audio-api shape: an `onEnded` accessor and no `onended` at all. */
function libraryShapedNode(
  node: Omit<AudioBufferSourceNodeLike, 'onended'>,
): AudioBufferSourceNodeLike {
  return node as AudioBufferSourceNodeLike;
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

  /** Context whose sources expose only the react-native-audio-api `onEnded` accessor. */
  function onEndedContext(sink: {
    handler: (() => void) | null;
    gainDisconnects: number;
  }): AudioContextLike {
    return {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain() {
        return {
          gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
          connect() {},
          disconnect() {
            sink.gainDisconnects++;
          },
        };
      },
      createBufferSource() {
        return libraryShapedNode({
          buffer: null,
          loop: false,
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
          get onEnded() {
            return sink.handler;
          },
          set onEnded(h: (() => void) | null) {
            sink.handler = h;
          },
        });
      },
      async resume() {},
      async suspend() {},
      async close() {},
    };
  }

  it('clears playing when the library fires onEnded (no onended accessor)', () => {
    const sink = { handler: null as (() => void) | null, gainDisconnects: 0 };
    const music = new Music();
    music.connect(onEndedContext(sink), mockGainNode());
    music.register('bgm', mockBuffer());
    music.play('bgm', false);
    expect(music.playing).toBe('bgm');
    expect(sink.handler).not.toBeNull();

    sink.handler?.();
    expect(music.playing).toBeNull();
    expect(sink.gainDisconnects).toBe(1);
  });

  it('clears playing when a DOM-shaped node fires onended', () => {
    const source: AudioBufferSourceNodeLike = {
      buffer: null,
      loop: false,
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
      onended: null,
    };
    const ctx: AudioContextLike = {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain: mockGainNode,
      createBufferSource: () => source,
      async resume() {},
      async suspend() {},
      async close() {},
    };
    const music = new Music();
    music.connect(ctx, mockGainNode());
    music.register('bgm', mockBuffer());
    music.play('bgm', false);
    expect(source.onended).not.toBeNull();

    source.onended?.call(source, undefined);
    expect(music.playing).toBeNull();
  });

  it('crossfadeTo registers the end handler through onEnded', () => {
    const sink = { handler: null as (() => void) | null, gainDisconnects: 0 };
    const music = new Music();
    music.connect(onEndedContext(sink), mockGainNode());
    music.register('bgm1', mockBuffer());
    music.register('bgm2', mockBuffer());
    music.play('bgm1');
    music.crossfadeTo('bgm2', 2, false);
    expect(music.playing).toBe('bgm2');

    // The sink holds the handler of the most recently created source: the new track.
    sink.handler?.();
    expect(music.playing).toBeNull();
  });
});
