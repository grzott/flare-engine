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

describe('Music node graph (characterization)', () => {
  const NOW = 10;

  interface Rig {
    log: string[];
    ctx: AudioContextLike;
    output: GainNodeLike;
    sources: AudioBufferSourceNodeLike[];
    gains: GainNodeLike[];
  }

  function recordingGain(rig: Rig, label: string, names: Map<object, string>): GainNodeLike {
    let value = 1;
    const node: GainNodeLike = {
      gain: {
        get value() {
          return value;
        },
        set value(v: number) {
          value = v;
          rig.log.push(`${label}.gain.value=${v}`);
        },
        setValueAtTime(v, time) {
          rig.log.push(`${label}.gain.setValueAtTime(${v},${time})`);
        },
        linearRampToValueAtTime(v, time) {
          rig.log.push(`${label}.gain.linearRampToValueAtTime(${v},${time})`);
        },
      },
      connect(dest) {
        rig.log.push(`${label}.connect(${names.get(dest) ?? '?'})`);
      },
      disconnect() {
        rig.log.push(`${label}.disconnect()`);
      },
    };
    names.set(node, label);
    return node;
  }

  function recordingSource(
    rig: Rig,
    label: string,
    names: Map<object, string>,
  ): AudioBufferSourceNodeLike {
    return {
      buffer: null,
      loop: false,
      connect(dest) {
        rig.log.push(`${label}.connect(${names.get(dest) ?? '?'})`);
      },
      disconnect() {
        rig.log.push(`${label}.disconnect()`);
      },
      start(when) {
        rig.log.push(`${label}.start(${when ?? ''})`);
      },
      stop(when) {
        rig.log.push(`${label}.stop(${when ?? ''})`);
      },
      onended: null,
    };
  }

  function createRig(): Rig {
    const names = new Map<object, string>();
    const rig: Rig = {
      log: [],
      sources: [],
      gains: [],
      output: mockGainNode(),
      ctx: {
        state: 'running',
        currentTime: NOW,
        destination: { channelCount: 2 },
        createGain() {
          const label = `gain${rig.gains.length + 1}`;
          rig.log.push(`createGain:${label}`);
          const node = recordingGain(rig, label, names);
          rig.gains.push(node);
          return node;
        },
        createBufferSource() {
          const label = `source${rig.sources.length + 1}`;
          rig.log.push(`createBufferSource:${label}`);
          const node = recordingSource(rig, label, names);
          rig.sources.push(node);
          return node;
        },
        async resume() {},
        async suspend() {},
        async close() {},
      },
    };
    names.set(rig.output, 'output');
    return rig;
  }

  function fireEnd(source: AudioBufferSourceNodeLike | undefined): void {
    source?.onended?.call(source, undefined);
  }

  it('play builds source -> gain(1) -> output and starts, in order', () => {
    const rig = createRig();
    const buffer = mockBuffer();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('a', buffer);

    music.play('a', false);

    expect(rig.log).toEqual([
      'createBufferSource:source1',
      'createGain:gain1',
      'gain1.gain.value=1',
      'source1.connect(gain1)',
      'gain1.connect(output)',
      'source1.start()',
    ]);
    expect(rig.sources[0]?.buffer).toBe(buffer);
    expect(rig.sources[0]?.loop).toBe(false);
    expect(rig.sources[0]?.onended).not.toBeNull();
    expect(music.playing).toBe('a');
  });

  it('play loops by default', () => {
    const rig = createRig();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('a', mockBuffer());

    music.play('a');

    expect(rig.sources[0]?.loop).toBe(true);
  });

  it('play over a playing track stops and disconnects the old one first', () => {
    const rig = createRig();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('a', mockBuffer());
    music.register('b', mockBuffer());
    music.play('a');
    rig.log.length = 0;

    music.play('b');

    expect(rig.log).toEqual([
      'source1.stop()',
      'gain1.disconnect()',
      'createBufferSource:source2',
      'createGain:gain2',
      'gain2.gain.value=1',
      'source2.connect(gain2)',
      'gain2.connect(output)',
      'source2.start()',
    ]);
    expect(music.playing).toBe('b');
  });

  it('crossfadeTo ramps the old gain down, the new gain up, and wires in order', () => {
    const rig = createRig();
    const bufferB = mockBuffer();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('a', mockBuffer());
    music.register('b', bufferB);
    music.play('a');
    const oldGain = rig.gains[0];
    if (!oldGain) throw new Error('play created no gain');
    oldGain.gain.value = 0.4;
    rig.log.length = 0;

    music.crossfadeTo('b', 2);

    expect(rig.log).toEqual([
      'gain1.gain.setValueAtTime(0.4,10)',
      'gain1.gain.linearRampToValueAtTime(0,12)',
      'source1.stop(12)',
      'createBufferSource:source2',
      'createGain:gain2',
      'gain2.gain.setValueAtTime(0,10)',
      'gain2.gain.linearRampToValueAtTime(1,12)',
      'source2.connect(gain2)',
      'gain2.connect(output)',
      'source2.start()',
    ]);
    expect(rig.sources[1]?.buffer).toBe(bufferB);
    expect(rig.sources[1]?.loop).toBe(true);
    expect(music.playing).toBe('b');
  });

  it('crossfadeTo passes the loop flag and fades in from nothing', () => {
    const rig = createRig();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('b', mockBuffer());

    music.crossfadeTo('b', 3, false);

    expect(rig.log).toEqual([
      'createBufferSource:source1',
      'createGain:gain1',
      'gain1.gain.setValueAtTime(0,10)',
      'gain1.gain.linearRampToValueAtTime(1,13)',
      'source1.connect(gain1)',
      'gain1.connect(output)',
      'source1.start()',
    ]);
    expect(rig.sources[0]?.loop).toBe(false);
    expect(music.playing).toBe('b');
  });

  it('end of the current source clears playing and disconnects its gain', () => {
    const rig = createRig();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('a', mockBuffer());
    music.play('a', false);
    rig.log.length = 0;

    fireEnd(rig.sources[0]);

    expect(rig.log).toEqual(['gain1.disconnect()']);
    expect(music.playing).toBeNull();
  });

  it('end of a superseded source disconnects its gain and keeps playing', () => {
    const rig = createRig();
    const music = new Music();
    music.connect(rig.ctx, rig.output);
    music.register('a', mockBuffer());
    music.register('b', mockBuffer());
    music.play('a');
    music.crossfadeTo('b', 2);
    rig.log.length = 0;

    fireEnd(rig.sources[0]);

    expect(rig.log).toEqual(['gain1.disconnect()']);
    expect(music.playing).toBe('b');

    fireEnd(rig.sources[1]);

    expect(rig.log).toEqual(['gain1.disconnect()', 'gain2.disconnect()']);
    expect(music.playing).toBeNull();
  });
});
