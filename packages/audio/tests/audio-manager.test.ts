import { describe, expect, it } from 'bun:test';
import { type AudioContextLike, AudioManager } from '../src/audio-manager.js';

function mockAudioContext(initialState: 'running' | 'suspended' = 'running'): AudioContextLike {
  let state = initialState as 'running' | 'suspended' | 'closed';
  return {
    get state() {
      return state;
    },
    currentTime: 0.5,
    destination: { channelCount: 2 },
    createGain() {
      return {
        gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    },
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
    async resume() {
      state = 'running';
    },
    async suspend() {
      state = 'suspended';
    },
    async close() {
      state = 'closed';
    },
  };
}

describe('AudioManager', () => {
  it('starts uninitialized', () => {
    const mgr = new AudioManager();
    expect(mgr.state).toBe('uninitialized');
    expect(mgr.context).toBeNull();
    expect(mgr.currentTime).toBe(0);
  });

  it('initializes with factory', () => {
    const mgr = new AudioManager();
    mgr.init(() => mockAudioContext());
    expect(mgr.state).toBe('running');
    expect(mgr.context).not.toBeNull();
    expect(mgr.currentTime).toBe(0.5);
  });

  it('ignores duplicate init calls', () => {
    const mgr = new AudioManager();
    const ctx1 = mockAudioContext();
    mgr.init(() => ctx1);
    const ctx2 = mockAudioContext();
    mgr.init(() => ctx2);
    expect(mgr.context).toBe(ctx1);
  });

  it('suspends and resumes', async () => {
    const mgr = new AudioManager();
    mgr.init(() => mockAudioContext());
    expect(mgr.state).toBe('running');

    await mgr.suspend();
    expect(mgr.state).toBe('suspended');

    await mgr.resume();
    expect(mgr.state).toBe('running');
  });

  it('suspend is no-op when already suspended', async () => {
    const mgr = new AudioManager();
    mgr.init(() => mockAudioContext('suspended'));
    await mgr.suspend(); // Should not throw
    expect(mgr.state).toBe('suspended');
  });

  it('resume is no-op when already running', async () => {
    const mgr = new AudioManager();
    mgr.init(() => mockAudioContext('running'));
    await mgr.resume(); // Should not throw
    expect(mgr.state).toBe('running');
  });

  it('closes the context', async () => {
    const mgr = new AudioManager();
    mgr.init(() => mockAudioContext());
    await mgr.close();
    expect(mgr.state).toBe('uninitialized');
    expect(mgr.context).toBeNull();
  });

  it('close is no-op when not initialized', async () => {
    const mgr = new AudioManager();
    await mgr.close(); // Should not throw
  });
});
