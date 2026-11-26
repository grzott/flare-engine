// `modern-screenshot` is an optional peer that the workspace does not install. This is the part
// of it the capture adapter calls.
declare module 'modern-screenshot' {
  export function domToCanvas(
    node: HTMLElement,
    options?: {
      scale?: number;
      width?: number;
      height?: number;
      style?: Record<string, string>;
    },
  ): Promise<HTMLCanvasElement>;
}
