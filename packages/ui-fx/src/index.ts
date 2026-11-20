export const UI_FX_ENTRY = 'rn';

export {
  createFlareComponent,
  type FlareComponent,
  type FlareHostProps,
} from './rn/create-flare-component';
export { FlareProvider, type FlareProviderProps } from './rn/provider';
export { type FlareFx, useFlareFx } from './rn/use-flare-fx';
export {
  FlareButton,
  type FlareButtonProps,
  FlareImage,
  FlarePressable,
  FlareText,
  FlareView,
} from './rn/wrappers';
export type { FxEvent, ProgressSource, ReducedMotionSource } from './runtime/contracts';
export type { FlareElementOptions } from './runtime/element';
