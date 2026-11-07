export {
  type AudioBufferLike,
  type AudioBufferSourceNodeLike,
  type AudioContextLike,
  type AudioDestinationNodeLike,
  AudioManager,
  type AudioParamLike,
  type AudioState,
  type GainNodeLike,
  type PCMBufferLike,
} from './audio-manager.js';

export { type Channel, type ChannelName, createChannels } from './channels.js';
export { Music } from './music.js';
export { type PlaySFXOptions, type SFXHandle, SFXPool } from './sfx-pool.js';
export {
  fillPCMBuffer,
  renderSynth,
  type SynthEnvelope,
  type SynthSound,
  type SynthWaveform,
  synthSampleCount,
} from './synth.js';
