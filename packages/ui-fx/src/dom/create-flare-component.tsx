import {
  type ComponentType,
  type CSSProperties,
  type FunctionComponent,
  type JSX,
  type JSXElementConstructor,
  type MouseEventHandler,
  type PointerEvent,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
  type RefAttributes,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  type ElementPlatform,
  type FlareElementOptions,
  useFlareElement,
} from '../runtime/element';
import { createWebLiveDriver } from '../web/live-driver';
import { exitA11yProps, moveFocusOff } from '../web/reduced-motion';
import { bindFlareFx } from './use-flare-fx';

/** What `createFlareComponent` wraps: a tag name, or a component. */
export type FlareHost = keyof JSX.IntrinsicElements | JSXElementConstructor<never>;

/**
 * The props of `T`: those of the element a tag names, or those of a component, with the `ref` a
 * class component takes but does not list among them.
 */
export type FlareHostProps<T> = T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : T extends new (
        props: infer P,
        ...rest: never[]
      ) => infer Instance
    ? P & RefAttributes<Instance>
    : T extends (props: infer P) => unknown
      ? P
      : never;

/** `T` with the Flare element options added. It takes the same `ref` as `T`. */
export type FlareComponent<T extends FlareHost> = FunctionComponent<
  FlareHostProps<T> & FlareElementOptions
>;

/** The host props the wrapper reads, sets or wraps. Everything else passes through untouched. */
interface HostProps {
  ref?: Ref<unknown>;
  style?: CSSProperties;
  onPointerDown?: PointerEventHandler;
  onPointerUp?: PointerEventHandler;
  onPointerCancel?: PointerEventHandler;
  onPointerLeave?: PointerEventHandler;
  onClick?: MouseEventHandler;
}

// Also true of an element from another document, which `instanceof` would turn away.
const isElement = (host: unknown): host is HTMLElement =>
  typeof host === 'object' &&
  host !== null &&
  'animate' in host &&
  typeof host.animate === 'function';

/** The laid-out size of `host`, or `null` when it is not an element. */
function measuredSize(host: unknown): { w: number; h: number } | null {
  if (!isElement(host)) return null;
  const rect = host.getBoundingClientRect();
  return { w: rect.width, h: rect.height };
}

/**
 * Wrap a tag or a component so it takes the Flare element options: `enter`, `exit`, `press`,
 * `exitOn` and the rest of `FlareElementOptions`. Call it once, at module scope, never during a
 * render.
 *
 * A component must pass its `ref` and the host props it is given (`style`, `aria-hidden`, the
 * pointer handlers and `onClick`) on to one DOM element. That element is animated through the Web
 * Animations API: the transform adds to its own, and the opacity replaces its own once a preset
 * has played.
 *
 * The press point is where `onPointerDown` landed, measured from the top left of the element's
 * `getBoundingClientRect()`. A click completes a press, so `exitOn: 'press'` exits on a click.
 * While the element exits it has `pointer-events: none` and `aria-hidden`, and keyboard focus
 * inside it moves to the next sibling that can take it; once a press exit has ended it renders
 * nothing.
 */
export function createFlareComponent<T extends FlareHost>(host: T): FlareComponent<T> {
  const Host = host as unknown as ComponentType<HostProps>;

  // biome-ignore lint/correctness/noComponentHookFactories: the factory runs once per component, at module scope
  function FlareHostComponent(props: HostProps & FlareElementOptions): ReactNode {
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
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onClick,
      ...rest
    } = props;

    const node = useRef<unknown>(null);
    const pressed = useRef(false);
    const created = useRef<ElementPlatform | null>(null);
    created.current ??= {
      driver: null,
      target: null,
      size: () => measuredSize(node.current),
    };
    const platform = created.current;

    // Declared before `useFlareElement`, so its mount effect already finds the driver.
    useLayoutEffect(() => {
      if (!isElement(node.current)) return;
      const driver = createWebLiveDriver(node.current);
      platform.driver = driver;
      // The driver holds animations on the element. Left behind, as by the first of StrictMode's
      // two effect passes, their transforms would add to the next driver's.
      return () => {
        platform.driver = null;
        driver.dispose();
      };
    }, [platform]);

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

    // On the render that starts the exit, so focus has left before anything hides the element.
    useLayoutEffect(() => {
      if (exiting && isElement(node.current)) moveFocusOff(node.current);
    }, [exiting]);

    useLayoutEffect(() => {
      const bound = node.current;
      if (typeof bound !== 'object' || bound === null) return;
      return bindFlareFx(bound, { play, prepare });
    }, [play, prepare]);

    const attach = useCallback(
      (next: unknown) => {
        node.current = next;
        if (typeof ref === 'function') {
          const cleanup = ref(next);
          if (typeof cleanup !== 'function') return;
          return () => {
            node.current = null;
            cleanup();
          };
        }
        if (ref != null) ref.current = next;
      },
      [ref],
    );

    if (handle.phase === 'released') return null;

    const pressOut =
      (own: PointerEventHandler | undefined): PointerEventHandler =>
      (event) => {
        // A pointer that only passes over the element leaves it too, with nothing to release.
        if (pressed.current) {
          pressed.current = false;
          handle.onPressOut();
        }
        own?.(event);
      };
    const handlers: HostProps = {
      onPointerDown(event: PointerEvent) {
        const rect = event.currentTarget.getBoundingClientRect();
        pressed.current = true;
        handle.onPressIn({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        onPointerDown?.(event);
      },
      onPointerUp: pressOut(onPointerUp),
      onPointerCancel: pressOut(onPointerCancel),
      onPointerLeave: pressOut(onPointerLeave),
      onClick,
    };
    if (exitOn === 'press') {
      handlers.onClick = (event) => {
        onClick?.(event);
        handle.onPress();
      };
    }

    return (
      <Host
        {...rest}
        {...handlers}
        {...exitA11yProps(exiting)}
        ref={attach}
        style={exiting ? { ...style, pointerEvents: 'none' } : style}
      />
    );
  }

  return FlareHostComponent as unknown as FlareComponent<T>;
}
