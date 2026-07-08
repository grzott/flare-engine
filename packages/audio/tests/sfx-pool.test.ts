import { describe, expect, it } from 'bun:test';
import type { AudioBufferLike, AudioContextLike, GainNodeLike } from '../src/audio-manager.js';
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

  it('throws when maxPolyphony is 0', () => {
    expect(() => new SFXPool(0)).toThrow('SFXPool: maxPolyphony must be > 0');
  });

  it('throws when maxPolyphony is negative', () => {
    expect(() => new SFXPool(-1)).toThrow('SFXPool: maxPolyphony must be > 0');
  });
});
