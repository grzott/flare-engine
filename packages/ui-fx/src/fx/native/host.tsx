import {
  Atlas,
  Canvas,
  type CanvasProps,
  type SkHostRect,
  type SkImage,
  type SkRSXform,
  useRectBuffer,
  useRSXformBuffer,
} from '@shopify/react-native-skia';
import {
  type ComponentType,
  type Dispatch,
  memo,
  type ReactNode,
  type Ref,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { makeMutable, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Vec2Out } from '../../core/conventions';
import type { RectLike } from '../../core/placement';
import type { SnapshotPreset } from '../../core/presets';
import type {
  FxImage,
  FxRun,
  FxRunOptions,
  FxRuntime,
  FxTarget,
  ProgressSource,
} from '../../runtime/contracts';
import { CAPTURE_MAX_PX } from '../../runtime/element';
import {
  FlareContext,
  type FlareContextValue,
  useFlareContext,
} from '../../runtime/provider-context';
import { acquireFastDisplayMode } from './display-mode';
import { createSpritePool, SPRITE_POOL_CAPACITY, type SpritePool } from './pool';

declare const process: { env: { NODE_ENV?: string } } | undefined;

/** How far a capture reaches beyond its element on every side, in layout pixels (C36). */
export const CAPTURE_PADDING = 24;

/** What one run's layer draws from. Made once per run, on the JS thread. */
export interface NativeRunState {
  preset: SnapshotPreset;
  /** The element's box in window coordinates. */
  rect: RectLike;
  /** The capture. It reaches `image.padding` layout pixels beyond `rect` on every side. */
  image: FxImage;
  direction: 1 | -1;
  /** The press point in element pixels, or `null` without one. */
  press: Vec2Out | null;
  progress: ProgressSource | undefined;
  /** The target's `hidden`. The first-frame worklet sets it to 1: see `handOff`. */
  hidden: { value: number };
  /**
   * When the run started, in seconds on the UI thread's frame clock; -1 until its first frame,
   * whose worklet writes it. Every later pose is computed from it.
   */
  startTime: SharedValue<number>;
  pool: SpritePool;
  /** The first pool sprite the run claimed, or -1 when it claimed none. */
  spriteStart: number;
  spriteCount: number;
}

/** The props of a layer that is mounted in the host's canvas for one run. */
export interface EffectLayerProps {
  run: NativeRunState;
  /** Call on the JS thread once the first frame is drawn and the target is hidden. */
  onFirstFrame(): void;
  /** Call on the JS thread when the effect ends. The host then unmounts the layer. */
  onDone(finished: boolean): void;
}

/** How one snapshot preset draws on native. */
export interface NativeEffect {
  /** How many pool sprites a run claims, or 0 when it draws none from the pool. */
  sprites(preset: SnapshotPreset, rect: RectLike, image: FxImage): number;
  /** Mounted in the canvas for the length of a run. It may draw nothing of its own. */
  Layer: ComponentType<EffectLayerProps>;
}

/** The effect a preset plays with, or `null` when native has none: the run then falls back. */
export type NativeEffects = (preset: SnapshotPreset) => NativeEffect | null;

export interface FlareFxHostProps {
  children?: ReactNode;
  /** Passed to the RN-Skia canvas. Without it Android draws on a TextureView. */
  android?: { surfaceType?: 'TextureView' | 'SurfaceView'; zOrderOnTop?: boolean };
}

interface MountedLayer {
  id: number;
  props: EffectLayerProps;
  Layer: ComponentType<EffectLayerProps>;
}

interface Host {
  alive: boolean;
  serial: number;
  effects: NativeEffects;
  pool: SpritePool;
  /** The capture the pool's `<Atlas>` draws from. */
  poolImage: SharedValue<SkImage | null>;
  /** How many runs hold pool sprites. */
  poolRuns: number;
  setLayers: Dispatch<SetStateAction<readonly MountedLayer[]>>;
  /** One per run that has not ended: ends it unfinished, for when the host goes away. */
  aborts: Set<() => void>;
}

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

// The workspace builds against an older RN-Skia than the peer floor, 2.14, whose canvas takes
// `android` (spec §3.3).
const FxCanvas = Canvas as ComponentType<CanvasProps & Pick<FlareFxHostProps, 'android'>>;

let warnedPoolFull = false;

function warnPoolFull(): void {
  if (warnedPoolFull) return;
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
  warnedPoolFull = true;
  console.warn(
    `ui-fx: the snapshot effects playing at once need more than ${SPRITE_POOL_CAPACITY} sprites. Playing the live fallback.`,
  );
}

/**
 * For a layer's frame worklet, on the frame it first draws: hide the target on this UI frame,
 * then tell JS. The element and its overlay are therefore never both on screen, or both missing.
 */
export function handOff(hidden: { value: number }, onFirstFrame: () => void): void {
  'worklet';
  hidden.value = 1;
  scheduleOnRN(onFirstFrame);
}

function startRun(host: Host, t: FxTarget, p: SnapshotPreset, o: FxRunOptions): FxRun {
  let stage: 'capturing' | 'mounted' | 'handed' | 'ended' = 'capturing';
  let cancelled = false;
  let layer: MountedLayer | null = null;
  let releaseDisplayMode: (() => void) | null = null;

  const end = (finished: boolean): void => {
    if (stage === 'ended') return;
    stage = 'ended';
    host.aborts.delete(abort);
    if (layer !== null) {
      const gone = layer;
      const { spriteStart, spriteCount } = gone.props.run;
      host.setLayers((layers) => layers.filter((mounted) => mounted !== gone));
      if (spriteCount > 0) {
        host.pool.free(spriteStart, spriteCount);
        if (--host.poolRuns === 0) host.poolImage.value = null;
      }
    }
    releaseDisplayMode?.();
    o.onEnd(finished);
  };

  function abort(): void {
    // The UI thread may have hidden the target already, with `onFirstFrame` still on its way.
    // An enter that was handed off has nothing left to reveal its element either.
    if (stage === 'mounted' || (stage === 'handed' && o.direction === 1)) t.hidden.value = 0;
    end(false);
  }

  const fallBack = (): void => {
    stage = 'ended';
    host.aborts.delete(abort);
    o.onFallback();
  };

  const land = (rect: RectLike | null, image: FxImage | null): void => {
    if (cancelled || !host.alive) {
      end(false);
      return;
    }
    const effect = rect === null || image === null ? null : host.effects(p);
    if (rect === null || image === null || effect === null) {
      fallBack();
      return;
    }
    const spriteCount = effect.sprites(p, rect, image);
    let spriteStart = -1;
    if (spriteCount > 0) {
      spriteStart = host.pool.claim(spriteCount);
      if (spriteStart < 0) {
        warnPoolFull();
        fallBack();
        return;
      }
      host.poolRuns++;
      // `captureView` puts an `SkImage` in `handle`.
      host.poolImage.value = image.handle as SkImage | null;
    }
    layer = {
      id: ++host.serial,
      Layer: effect.Layer,
      props: {
        run: {
          preset: p,
          rect,
          image,
          direction: o.direction,
          press: o.press,
          progress: o.progress,
          hidden: t.hidden,
          startTime: makeMutable(-1),
          pool: host.pool,
          spriteStart,
          spriteCount: spriteStart < 0 ? 0 : spriteCount,
        },
        onFirstFrame() {
          if (stage !== 'mounted') return;
          stage = 'handed';
          releaseDisplayMode = acquireFastDisplayMode();
          o.onHandoff();
        },
        onDone(finished) {
          if (stage === 'mounted' || stage === 'handed') end(finished);
        },
      },
    };
    stage = 'mounted';
    const mounted = layer;
    host.setLayers((layers) => [...layers, mounted]);
  };

  const capture = async (): Promise<void> => {
    let rect: RectLike | null = null;
    let image: FxImage | null = null;
    try {
      rect = await t.measure();
      if (rect !== null && rect.width > 0 && rect.height > 0) {
        image = await t.capture(CAPTURE_MAX_PX);
      }
    } catch {
      image = null;
    }
    land(rect, image);
  };

  host.aborts.add(abort);
  capture();

  return {
    cancel() {
      if (cancelled || stage === 'handed' || stage === 'ended') return false;
      cancelled = true;
      // A capture still in flight ends the run when it lands.
      if (stage === 'mounted') abort();
      return true;
    },
  };
}

/** The pool's one `<Atlas>`. Its props never change, so it mounts once and never re-renders. */
const PoolAtlas = memo(function PoolAtlas({
  pool,
  image,
}: {
  pool: SpritePool;
  image: SharedValue<SkImage | null>;
}): ReactNode {
  const { transforms, rects } = pool;
  const xforms = useRSXformBuffer(pool.capacity, (xform: SkRSXform, i: number) => {
    'worklet';
    const buffer = transforms.value;
    const o = i * 4;
    xform.set(buffer[o]!, buffer[o + 1]!, buffer[o + 2]!, buffer[o + 3]!);
  });
  const sprites = useRectBuffer(pool.capacity, (rect: SkHostRect, i: number) => {
    'worklet';
    const buffer = rects.value;
    const o = i * 4;
    rect.setXYWH(buffer[o]!, buffer[o + 1]!, buffer[o + 2]!, buffer[o + 3]!);
  });
  return <Atlas image={image} sprites={sprites} transforms={xforms} />;
});

/** `FlareFxHost` with the effect table given. `FlareFxHost` is the public form. */
export function NativeFxHost({
  children,
  android,
  effects,
}: FlareFxHostProps & { effects: NativeEffects }): ReactNode {
  const parent = useFlareContext();
  const [layers, setLayers] = useState<readonly MountedLayer[]>([]);

  const created = useRef<{ host: Host; fx: FxRuntime } | null>(null);
  if (created.current === null) {
    const host: Host = {
      alive: true,
      serial: 0,
      effects,
      pool: createSpritePool(SPRITE_POOL_CAPACITY),
      poolImage: makeMutable<SkImage | null>(null),
      poolRuns: 0,
      setLayers,
      aborts: new Set(),
    };
    created.current = { host, fx: { run: (t, p, o) => startRun(host, t, p, o) } };
  }
  const { host, fx } = created.current;

  useLayoutEffect(() => {
    host.effects = effects;
  });

  useLayoutEffect(() => {
    host.alive = true;
    return () => {
      host.alive = false;
      for (const abort of [...host.aborts]) abort();
    };
  }, [host]);

  const surfaceType = android?.surfaceType;
  const zOrderOnTop = android?.zOrderOnTop;
  const surface = useMemo(
    () =>
      surfaceType === undefined && zOrderOnTop === undefined
        ? undefined
        : { surfaceType, zOrderOnTop },
    [surfaceType, zOrderOnTop],
  );
  const hostFactory = useCallback(
    (): ReactNode => nestedHost(surface, effects),
    [surface, effects],
  );
  const value = useMemo<FlareContextValue>(
    () => ({ ...parent, fx, hostFactory }),
    [parent, fx, hostFactory],
  );

  return (
    <FlareContext.Provider value={value}>
      {children}
      <FxCanvas
        style={FILL}
        pointerEvents="none"
        {...(surface === undefined ? undefined : { android: surface })}
      >
        <PoolAtlas pool={host.pool} image={host.poolImage} />
        {layers.map(({ id, Layer, props }) => (
          <Layer key={id} {...props} />
        ))}
      </FxCanvas>
    </FlareContext.Provider>
  );
}

function nestedHost(android: FlareFxHostProps['android'], effects: NativeEffects): ReactNode {
  return <NativeFxHost android={android} effects={effects} />;
}

// No preset has a native effect yet, so every run plays its live fallback.
const NO_EFFECTS: NativeEffects = () => null;

/**
 * The snapshot-effect host on React Native: it gives the elements below it the runtime that
 * plays `shatter`, `disintegrate`, `dust` and shader `emerge`, and draws them on one RN-Skia
 * canvas, an absolute fill above `children` that takes no touches.
 *
 * Mount it inside `FlareProvider`, where it fills the screen. The nearest host plays an element's
 * effects. Until a preset has a native effect, its run plays the preset's live fallback.
 */
export function FlareFxHost({ children, android }: FlareFxHostProps): ReactNode {
  return (
    <NativeFxHost android={android} effects={NO_EFFECTS}>
      {children}
    </NativeFxHost>
  );
}

/**
 * The view a native capture is taken of: `ref` goes to `captureView`. It is larger than its child
 * by `padding` on every side, so a shadow the child draws outside its own bounds is in the image,
 * and it is `collapsable={false}`, which `makeImageFromView` needs.
 *
 * The negative margin takes back what the padding adds, so the child is laid out where it would
 * be without the root. Touches in the padding fall through.
 */
export function FxCaptureRoot({
  children,
  ref,
  padding = CAPTURE_PADDING,
}: {
  children?: ReactNode;
  ref: Ref<View>;
  padding?: number;
}): ReactNode {
  const style = useMemo(() => ({ padding, margin: -padding }), [padding]);
  return (
    <View ref={ref} collapsable={false} pointerEvents="box-none" style={style}>
      {children}
    </View>
  );
}
