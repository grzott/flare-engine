export const UI_FX_ENTRY = 'fx-native';

export { captureView } from './fx/native/capture';
export { acquireFastDisplayMode } from './fx/native/display-mode';
export {
  CAPTURE_PADDING,
  type EffectLayerProps,
  FlareFxHost,
  type FlareFxHostProps,
  FxCaptureRoot,
  handOff,
  type NativeRunState,
} from './fx/native/host';
export { createSpritePool, SPRITE_POOL_CAPACITY, type SpritePool } from './fx/native/pool';
export type { FxImage } from './runtime/contracts';
