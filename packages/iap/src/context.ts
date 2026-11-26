import { createContext, useContext } from 'react';
import { type IAPProvider, NoopIAPProvider } from './provider.js';

/** React context carrying the active `IAPProvider`. Defaults to `NoopIAPProvider`. */
export const IAPContext = /* @__PURE__ */ createContext<IAPProvider>(NoopIAPProvider);

/** Hook returning the current `IAPProvider`. */
export function useIAP(): IAPProvider {
  return useContext(IAPContext);
}
