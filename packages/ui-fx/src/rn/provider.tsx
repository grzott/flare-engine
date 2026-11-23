import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { I18nManager, View } from 'react-native';
import { createPresetRegistry, type PresetRegistry } from '../core/registry';
import { nativeReducedMotionSource } from '../native/reduced-motion';
import type { ReducedMotionSource } from '../runtime/contracts';
import { FlareContext, type FlareContextValue } from '../runtime/provider-context';

export interface FlareProviderProps {
  children?: ReactNode;
  /** Resolves the preset names its elements use. Defaults to an empty registry of its own. */
  registry?: PresetRegistry;
  /** Defaults to the OS reduce-motion setting. */
  reducedMotion?: ReducedMotionSource;
  /** Whether `'start'` is the right edge. Defaults to `I18nManager.isRTL`. */
  rtl?: boolean;
}

/** What is portalled into one provider's overlay layer, in mount order. */
interface OverlayStore {
  nodes: Map<string, ReactNode>;
  listeners: Set<() => void>;
  version: number;
}

const OverlayContext = /* @__PURE__ */ createContext<OverlayStore | null>(null);

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

// The source's OS listener is never removed, so every provider shares the one made here.
let defaultReducedMotion: ReducedMotionSource | null = null;

function changed(store: OverlayStore): void {
  store.version++;
  for (const listener of store.listeners) listener();
}

// React Native has no portal, so the content is handed to the layer and rendered there. It
// therefore sees the contexts above the provider, not those around the component that sent it.
function OverlayPortal({ children }: { children: ReactNode }): ReactNode {
  const store = useContext(OverlayContext);
  const id = useId();

  useLayoutEffect(() => {
    if (store === null || (store.nodes.has(id) && store.nodes.get(id) === children)) return;
    store.nodes.set(id, children);
    changed(store);
  });

  useLayoutEffect(() => {
    if (store === null) return;
    return () => {
      if (store.nodes.delete(id)) changed(store);
    };
  }, [store, id]);

  return null;
}

function OverlayLayer({ store }: { store: OverlayStore }): ReactNode {
  const subscribe = useMemo(
    () => (listener: () => void) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [store],
  );
  const version = (): number => store.version;
  useSyncExternalStore(subscribe, version, version);

  return (
    <View style={FILL} pointerEvents="box-none">
      {Array.from(store.nodes, ([id, node]) => (
        <Fragment key={id}>{node}</Fragment>
      ))}
    </View>
  );
}

/**
 * The root of ui-fx in a React Native app: it gives the elements below it their preset registry,
 * reduced-motion source and writing direction, and renders the overlay layer, an absolute fill
 * above `children` that lets touches through.
 *
 * Mount it where it fills the screen. It imports no Skia: snapshot presets play their live
 * fallback until an FX host is mounted inside it.
 */
export function FlareProvider({
  children,
  registry,
  reducedMotion,
  rtl,
}: FlareProviderProps): ReactNode {
  const ownRegistry = useRef<PresetRegistry | null>(null);
  const overlay = useRef<OverlayStore | null>(null);
  overlay.current ??= { nodes: new Map(), listeners: new Set(), version: 0 };
  const store = overlay.current;

  let resolvedRegistry = registry;
  if (resolvedRegistry === undefined) {
    ownRegistry.current ??= createPresetRegistry();
    resolvedRegistry = ownRegistry.current;
  }
  let source = reducedMotion;
  if (source === undefined) {
    defaultReducedMotion ??= nativeReducedMotionSource();
    source = defaultReducedMotion;
  }
  const resolvedRtl = rtl ?? I18nManager.isRTL;

  const value = useMemo<FlareContextValue>(
    () => ({
      registry: resolvedRegistry,
      reducedMotion: source,
      fx: null,
      overlay: OverlayPortal,
      hostFactory: null,
      rtl: resolvedRtl,
    }),
    [resolvedRegistry, source, resolvedRtl],
  );

  return (
    <FlareContext.Provider value={value}>
      <OverlayContext.Provider value={store}>
        {children}
        <OverlayLayer store={store} />
      </OverlayContext.Provider>
    </FlareContext.Provider>
  );
}
