import { describe, expect, it } from 'bun:test';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  GainNodeLike,
} from '../src/audio-manager.js';
import { SFXPool } from '../src/sfx-pool.js';

function mockBuffer(): AudioBufferLike {
  return { duration: 1, numberOfChannels: 1, sampleRate: 44100, length: 44100 };
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

interface StartSink {
  /** One entry per `start` call: its argument list, so a bare `start()` is told apart from `start(undefined)`. */
  starts: [when?: number][];
  stops: number;
}

function startSink(): StartSink {
  return { starts: [], stops: 0 };
}

/** Context at a non-zero clock whose sources record every `start`/`stop` call. */
function recordingContext(sink: StartSink): AudioContextLike {
  return {
    state: 'running',
    currentTime: 2,
    destination: { channelCount: 2 },
    createGain: mockGainNode,
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        disconnect() {},
        start(...args: [when?: number]) {
          sink.starts.push(args);
        },
        stop() {
          sink.stops++;
        },
        onended: null,
      };
    },
    async resume() {},
    async suspend() {},
    async close() {},
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

describe('SFXPool', () => {
  it('starts empty', () => {
    const pool = new SFXPool();
    expect(pool.size).toBe(0);
    expect(pool.activeCount).toBe(0);
  });

  it('registers and unregisters buffers', () => {
    const pool = new SFXPool();
    pool.register('hit', mockBuffer());
    expect(pool.has('hit')).toBe(true);
    expect(pool.size).toBe(1);
    pool.unregister('hit');
    expect(pool.has('hit')).toBe(false);
  });

  it('returns null when playing unregistered sound', () => {
    const pool = new SFXPool();
    pool.connect(mockAudioContext(), mockGainNode());
    expect(pool.play('nonexistent')).toBeNull();
  });

  it('returns null when not connected', () => {
    const pool = new SFXPool();
    pool.register('hit', mockBuffer());
    expect(pool.play('hit')).toBeNull();
  });

  it('plays a registered sound', () => {
    const pool = new SFXPool();
    pool.connect(mockAudioContext(), mockGainNode());
    pool.register('hit', mockBuffer());

    const handle = pool.play('hit');
    expect(handle).not.toBeNull();
    expect(pool.activeCount).toBe(1);
  });

  it('stop handle removes from active', () => {
    const pool = new SFXPool();
    pool.connect(mockAudioContext(), mockGainNode());
    pool.register('hit', mockBuffer());

    const handle = pool.play('hit')!;
    handle.stop();
    expect(pool.activeCount).toBe(0);
  });

  it('stopAll clears all active sounds', () => {
    const pool = new SFXPool();
    pool.connect(mockAudioContext(), mockGainNode());
    pool.register('hit', mockBuffer());
    pool.register('boom', mockBuffer());

    pool.play('hit');
    pool.play('boom');
    expect(pool.activeCount).toBe(2);

    pool.stopAll();
    expect(pool.activeCount).toBe(0);
  });

  it('kills oldest when max polyphony reached', () => {
    const pool = new SFXPool(2); // Max 2
    pool.connect(mockAudioContext(), mockGainNode());
    pool.register('a', mockBuffer());

    pool.play('a');
    pool.play('a');
    expect(pool.activeCount).toBe(2);

    pool.play('a'); // Should kill oldest
    expect(pool.activeCount).toBe(2);
  });

  it('plays with custom volume and loop', () => {
    let capturedGainValue = -1;
    let capturedLoop = false;
    const ctx: AudioContextLike = {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain() {
        const g = mockGainNode();
        const origGain = g.gain;
        return {
          ...g,
          gain: {
            get value() {
              return origGain.value;
            },
            set value(v) {
              origGain.value = v;
              capturedGainValue = v;
            },
            setValueAtTime() {},
            linearRampToValueAtTime() {},
          },
        };
      },
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect() {},
          disconnect() {},
          start() {
            capturedLoop = this.loop;
          },
          stop() {},
          onended: null,
        };
      },
      async resume() {},
      async suspend() {},
      async close() {},
    };

    const pool = new SFXPool();
    pool.connect(ctx, mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a', { volume: 0.5, loop: true });

    expect(capturedGainValue).toBe(0.5);
    expect(capturedLoop).toBe(true);
  });

  it('applies rate when the node exposes a playbackRate param', () => {
    const rateParam = { value: 1 };
    const ctx: AudioContextLike = {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain: mockGainNode,
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          playbackRate: rateParam,
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

    const pool = new SFXPool();
    pool.connect(ctx, mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a', { rate: 1.5 });

    expect(rateParam.value).toBe(1.5);
  });

  it('applies rate: 0 (guard is undefined-based, not falsy-based)', () => {
    const rateParam = { value: 1 };
    const ctx: AudioContextLike = {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain: mockGainNode,
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          playbackRate: rateParam,
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

    const pool = new SFXPool();
    pool.connect(ctx, mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a', { rate: 0 });

    expect(rateParam.value).toBe(0);
  });

  it('leaves playbackRate untouched when rate is omitted', () => {
    const rateParam = { value: 1 };
    const ctx: AudioContextLike = {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain: mockGainNode,
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          playbackRate: rateParam,
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

    const pool = new SFXPool();
    pool.connect(ctx, mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a', { volume: 0.5 });

    expect(rateParam.value).toBe(1);
  });

  it('ignores rate when the node lacks a playbackRate param (no throw)', () => {
    // mockAudioContext's nodes expose no playbackRate.
    const pool = new SFXPool();
    pool.connect(mockAudioContext(), mockGainNode());
    pool.register('a', mockBuffer());

    expect(() => pool.play('a', { rate: 2 })).not.toThrow();
    expect(pool.activeCount).toBe(1);
  });

  it('schedules start at currentTime + delay on the context clock', () => {
    const sink = startSink();
    const pool = new SFXPool();
    pool.connect(recordingContext(sink), mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a', { delay: 0.35 });

    expect(sink.starts).toEqual([[2 + 0.35]]);
  });

  it('calls start with no argument when delay is omitted', () => {
    const sink = startSink();
    const pool = new SFXPool();
    pool.connect(recordingContext(sink), mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a');

    expect(sink.starts.map((args) => args.length)).toEqual([0]);
  });

  it('calls start with no argument when delay is 0, negative, NaN or Infinity', () => {
    for (const delay of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const sink = startSink();
      const pool = new SFXPool();
      pool.connect(recordingContext(sink), mockGainNode());
      pool.register('a', mockBuffer());
      pool.play('a', { delay });

      expect(sink.starts.map((args) => args.length)).toEqual([0]);
    }
  });

  it('stop on a scheduled handle stops the source and releases the voice', () => {
    const sink = startSink();
    const pool = new SFXPool();
    pool.connect(recordingContext(sink), mockGainNode());
    pool.register('a', mockBuffer());
    const handle = pool.play('a', { delay: 0.35 })!;
    expect(pool.activeCount).toBe(1);

    handle.stop();
    expect(sink.stops).toBe(1);
    expect(pool.activeCount).toBe(0);
  });

  it('releases the voice when the library fires onEnded (no onended accessor)', () => {
    const sink = { handler: null as (() => void) | null, gainDisconnects: 0 };
    const ctx: AudioContextLike = {
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

    const pool = new SFXPool();
    pool.connect(ctx, mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a');
    expect(pool.activeCount).toBe(1);
    expect(sink.handler).not.toBeNull();

    sink.handler?.();
    expect(pool.activeCount).toBe(0);
    expect(sink.gainDisconnects).toBe(1);
  });

  it('releases the voice when a DOM-shaped node fires onended', () => {
    let gainDisconnects = 0;
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
      createGain() {
        return {
          gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
          connect() {},
          disconnect() {
            gainDisconnects++;
          },
        };
      },
      createBufferSource: () => source,
      async resume() {},
      async suspend() {},
      async close() {},
    };

    const pool = new SFXPool();
    pool.connect(ctx, mockGainNode());
    pool.register('a', mockBuffer());
    pool.play('a');
    expect(pool.activeCount).toBe(1);
    expect(source.onended).not.toBeNull();

    source.onended?.call(source, undefined);
    expect(pool.activeCount).toBe(0);
    expect(gainDisconnects).toBe(1);
  });

  it('throws when maxPolyphony is 0', () => {
    expect(() => new SFXPool(0)).toThrow('SFXPool: maxPolyphony must be > 0');
  });

  it('throws when maxPolyphony is negative', () => {
    expect(() => new SFXPool(-1)).toThrow('SFXPool: maxPolyphony must be > 0');
  });
});
