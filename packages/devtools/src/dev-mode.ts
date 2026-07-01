declare const __DEV__: boolean | undefined;

export function isDevMode(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}
