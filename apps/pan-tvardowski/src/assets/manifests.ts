import audioJson from '../../assets/audio.manifest.json';
import portraitsJson from '../../assets/portraits.manifest.json';
import spritesJson from '../../assets/sprites.manifest.json';
import type { AudioManifest, PortraitsManifest, SpritesManifest } from './manifest-types';

export const SPRITES_MANIFEST: SpritesManifest = spritesJson as SpritesManifest;
export const AUDIO_MANIFEST: AudioManifest = audioJson as AudioManifest;
export const PORTRAITS_MANIFEST: PortraitsManifest = portraitsJson as PortraitsManifest;
