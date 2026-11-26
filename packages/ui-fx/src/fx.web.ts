export const UI_FX_ENTRY = 'fx-web';

export { FlareFxHost, type FlareFxHostProps } from './fx/web/host';
export type { FxImage } from './runtime/contracts';
export {
  CAPTURE_PADDING,
  captureView,
  modernScreenshotRasterizer,
  setWebRasterizer,
  type WebRasterizer,
} from './web/capture';
