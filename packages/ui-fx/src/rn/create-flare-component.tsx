import {
  type ComponentType,
  type FunctionComponent,
  type JSXElementConstructor,
  type ReactNode,
  type Ref,
  type RefAttributes,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  findNodeHandle,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
} from 'react-native';
import { createAnimatedComponent } from 'react-native-reanimated';
import { exitA11yProps, moveAccessibilityFocus } from '../native/a11y';
import { useNativeLiveDriver } from '../native/live-driver';
import type { LiveDriver } from '../runtime/contracts';
import {
  type ElementPlatform,
  type FlareElementOptions,
  useFlareElement,
} from '../runtime/element';
import { usePresence } from '../runtime/presence';
import { bindFlareFx } from './use-flare-fx';

/** The props of `C`, with the `ref` a class component takes but does not list among them. */
export type FlareHostProps<C> = C extends new (
  props: infer P,
  ...rest: never[]
) => infer Instance
  ? P & RefAttributes<Instance>
  : C extends (props: infer P) => unknown
    ? P
    : never;

/** `C` with the Flare element options added. It takes the same `ref` as `C`. */
export type FlareComponent<C extends JSXElementConstructor<never>> = FunctionComponent<
  FlareHostProps<C> & FlareElementOptions
>;

/** Where the press point comes from: every touch on the host, or a pressable's own press-in. */
type PressSource = 'touch' | 'press';

type TouchHandler = (event: GestureResponderEvent) => void;

/** The host props the wrapper reads, sets or wraps. Everything else passes through untouched. */
interface HostProps {
  ref?: Ref<unknown>;
  style?: unknown;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  onLayout?: (event: LayoutChangeEvent) => void;
  onTouchStart?: TouchHandler;
  onTouchEnd?: TouchHandler;
  onTouchCancel?: TouchHandler;
  onPressIn?: TouchHandler;
  onPressOut?: TouchHandler;
  onPress?: TouchHandler;
}

interface Size {
  w: number;
  h: number;
}

interface Measurable {
  getBoundingClientRect(): { width: number; height: number };
}

const isMeasurable = (host: unknown): host is Measurable =>
  typeof host === 'object' &&
  host !== null &&
  'getBoundingClientRect' in host &&
  typeof host.getBoundingClientRect === 'function';

/** The size of a host that has not reported a layout yet, or `null` when it cannot be measured. */
function measuredSize(host: unknown): Size | null {
  if (!isMeasurable(host)) return null;
  const rect = host.getBoundingClientRect();
  return { w: rect.width, h: rect.height };
}

/** The native tag of the view around `host`, or `null` when there is none to focus. */
function parentTagOf(host: unknown): number | null {
  // react-native-web has no native tags to give.
  if (Platform.OS === 'web') return null;
  if (typeof host !== 'object' || host === null || !('parentElement' in host)) return null;
  const parent = host.parentElement;
  if (typeof parent !== 'object' || parent === null) return null;
  return findNodeHandle(parent as Parameters<typeof findNodeHandle>[0]);
}

/**
 * The live driver of a mounted host: the seam where a platform swaps its own in. On native every
 * host is driven by the Reanimated driver its component owns.
 */
function driverFor(_host: unknown, native: LiveDriver): LiveDriver {
  return native;
}

function createFlareHost<C extends JSXElementConstructor<never>>(
  component: C,
  source: PressSource,
): FlareComponent<C> {
  const Animated = createAnimatedComponent(
    component as unknown as FunctionComponent<HostProps>,
  ) as unknown as ComponentType<HostProps>;

  // biome-ignore lint/correctness/noComponentHookFactories: the factory runs once per component, at module scope
  function FlareHost(props: HostProps & FlareElementOptions): ReactNode {
    const {
      enter,
      exit,
      press,
      exitOn,
      holdSpace,
      progress,
      reduceMotion,
      onEntered,
      onExited,
      onFx,
      ref,
      style,
      pointerEvents,
      onLayout,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      onPressIn,
      onPressOut,
      onPress,
      ...rest
    } = props;

    const { driver, style: animated } = useNativeLiveDriver();
    const host = useRef<unknown>(null);
    const layout = useRef<Size | null>(null);
    const created = useRef<ElementPlatform | null>(null);
    created.current ??= {
      driver: null,
      target: null,
      size: () => layout.current ?? measuredSize(host.current),
    };
    const platform = created.current;

    // Declared before `useFlareElement`, so its mount effect already finds the driver.
    useLayoutEffect(() => {
      platform.driver = driverFor(host.current, driver);
    }, [platform, driver]);

    const handle = useFlareElement(
      {
        enter,
        exit,
        press,
        exitOn,
        holdSpace,
        progress,
        reduceMotion,
        onEntered,
        onExited,
        onFx,
      },
      platform,
    );
    const { play, prepare } = handle;
    const exiting = handle.phase === 'exiting';

    // An exit that starts while the owner still renders the element was started by its own press.
    const [isPresent] = usePresence();
    const exitingByPress = exiting && isPresent;
    useLayoutEffect(() => {
      if (exitingByPress) moveAccessibilityFocus(parentTagOf(host.current));
    }, [exitingByPress]);

    useLayoutEffect(() => {
      const node = host.current;
      if (typeof node !== 'object' || node === null) return;
      return bindFlareFx(node, { play, prepare });
    }, [play, prepare]);

    const attach = useCallback(
      (node: unknown) => {
        host.current = node;
        if (typeof ref === 'function') {
          const cleanup = ref(node);
          if (typeof cleanup !== 'function') return;
          return () => {
            host.current = null;
            cleanup();
          };
        }
        if (ref != null) ref.current = node;
      },
      [ref],
    );

    if (handle.phase === 'released') return null;

    const pressIn: TouchHandler = (event) => {
      handle.onPressIn({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
      (source === 'touch' ? onTouchStart : onPressIn)?.(event);
    };
    const pressOut =
      (own: TouchHandler | undefined): TouchHandler =>
      (event) => {
        handle.onPressOut();
        own?.(event);
      };
    const handlers: HostProps =
      source === 'touch'
        ? {
            onTouchStart: pressIn,
            onTouchEnd: pressOut(onTouchEnd),
            onTouchCancel: pressOut(onTouchCancel),
            onPressIn,
            onPressOut,
          }
        : {
            onTouchStart,
            onTouchEnd,
            onTouchCancel,
            onPressIn: pressIn,
            onPressOut: pressOut(onPressOut),
          };
    // A host that is not pressable gets no `onPress` it did not ask for: on a Text it would make
    // the text take touches.
    if (onPress !== undefined || exitOn === 'press') {
      handlers.onPress = (event) => {
        onPress?.(event);
        handle.onPress();
      };
    }

    return (
      <Animated
        {...rest}
        {...handlers}
        {...exitA11yProps(exiting)}
        ref={attach}
        style={[style, animated]}
        pointerEvents={exiting ? 'none' : pointerEvents}
        onLayout={(event) => {
          layout.current ??= { w: 0, h: 0 };
          layout.current.w = event.nativeEvent.layout.width;
          layout.current.h = event.nativeEvent.layout.height;
          onLayout?.(event);
        }}
      />
    );
  }

  return FlareHost as unknown as FlareComponent<C>;
}

/**
 * Wrap a component so it takes the Flare element options: `enter`, `exit`, `press`, `exitOn` and
 * the rest of `FlareElementOptions`. Call it once, at module scope, never during a render.
 *
 * `C` must pass its `ref` and the host props it is given (`style`, `pointerEvents`, `onLayout`,
 * the touch handlers and the accessibility props) on to one host view. The animated style comes
 * last in `style` and owns `opacity` and `transform`.
 *
 * The press point is read from `onTouchStart`. `exitOn: 'press'` needs a `C` that calls `onPress`.
 * While the element exits it takes no touches and is hidden from the accessibility tree; once a
 * press exit has ended it renders nothing.
 */
export function createFlareComponent<C extends JSXElementConstructor<never>>(
  component: C,
): FlareComponent<C> {
  return createFlareHost(component, 'touch');
}

/** `createFlareComponent` for a pressable: the press point is read from `onPressIn` instead. */
export function createFlarePressable<C extends JSXElementConstructor<never>>(
  component: C,
): FlareComponent<C> {
  return createFlareHost(component, 'press');
}
