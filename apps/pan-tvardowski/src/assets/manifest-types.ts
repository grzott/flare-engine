export type SpriteEntryKind = 'shape-atlas' | 'texture-packer' | 'image';
export type AudioEntryKind = 'synth' | 'file';
export type PortraitEntryKind = 'shape' | 'image';

export interface SpriteEntry {
  readonly key: string;
  readonly kind: SpriteEntryKind;
  readonly source?: string;
  readonly image?: string;
  readonly json?: string;
}

export interface SpritesManifest {
  readonly version: number;
  readonly entries: readonly SpriteEntry[];
}

export interface AudioEntry {
  readonly key: string;
  readonly kind: AudioEntryKind;
  readonly source?: string;
  readonly path?: string;
}

export interface AudioManifest {
  readonly version: number;
  readonly sfx: readonly AudioEntry[];
  readonly music: readonly AudioEntry[];
}

export interface PortraitEntry {
  readonly key: string;
  readonly kind: PortraitEntryKind;
  readonly source?: string;
  readonly path?: string;
}

export interface PortraitsManifest {
  readonly version: number;
  readonly entries: readonly PortraitEntry[];
}
