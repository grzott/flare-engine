import type { AudioContextLike, GainNodeLike } from './audio-manager.js';

/** A volume channel that wraps a GainNode. */
export interface Channel {
  readonly name: string;
  /** Current volume (0.0 - 1.0). */
  volume: number;
  /** The underlying GainNode. */
  readonly node: GainNodeLike;
}

/** Standard channel names. */
export type ChannelName = 'master' | 'sfx' | 'music';

/**
 * Creates volume channels connected: sfx → master, music → master, master → destination.
 * Returns a map of channels by name.
 */
export function createChannels(ctx: AudioContextLike): Map<ChannelName, Channel> {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  const sfxGain = ctx.createGain();
  sfxGain.gain.value = 1;
  sfxGain.connect(masterGain);

  const musicGain = ctx.createGain();
  musicGain.gain.value = 1;
  musicGain.connect(masterGain);

  const channels = new Map<ChannelName, Channel>();

  channels.set('master', createChannel('master', masterGain));
  channels.set('sfx', createChannel('sfx', sfxGain));
  channels.set('music', createChannel('music', musicGain));

  return channels;
}

function createChannel(name: string, node: GainNodeLike): Channel {
  let vol = 1;
  return {
    name,
    get volume() {
      return vol;
    },
    set volume(v: number) {
      vol = Math.max(0, Math.min(1, v));
      node.gain.value = vol;
    },
    node,
  };
}
