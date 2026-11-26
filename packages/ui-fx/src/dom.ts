export const UI_FX_ENTRY = 'dom';

export {
  createFlareComponent,
  type FlareComponent,
  type FlareHost,
  type FlareHostProps,
} from './dom/create-flare-component';
export { FlareProvider, type FlareProviderProps } from './dom/provider';
export { type FlareFx, useFlareFx } from './dom/use-flare-fx';
export { FlareButton, FlareDiv, FlareImg, FlareLi, FlareSpan } from './dom/wrappers';
export { FlareFxHost, type FlareFxHostProps } from './fx/web/host';
export type { FxEvent, ProgressSource, ReducedMotionSource } from './runtime/contracts';
export type { FlareElementOptions } from './runtime/element';
