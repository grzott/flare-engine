import {
  Group,
  ImageShader,
  Rect,
  Shader,
  type SkImage,
  Skia,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { type ReactNode, useMemo } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DELAY, FRAG_STRIDE } from '../../../core/motion/layout';
import { DUST_SKSL, DUST_UNIFORM_SIZES, DUST_UNIFORMS } from '../../../core/sksl';
import { timingAt } from '../../../core/timing';
import { createDustRun, type DustRunPreset, dustGrainCount } from '../../dust';
import { type EffectLayerProps, handOff, type NativeEffect } from '../host';
import { grainSpritesInto } from './grains';
import { Unplayed } from './shatter';

/** The shader's uniforms as `<Shader>` takes them: by name, a vector as a list of numbers. */
type DustUniforms = Record<(typeof DUST_UNIFORMS)[number], number | number[]>;

const NO_FLOATS = new Float32Array(0);

let compiled: SkRuntimeEffect | null = null;

/** The compiled dust shader, made on first use and kept, or `null` when it does not compile. */
function dustSource(): SkRuntimeEffect | null {
  if (compiled === null) {
    try {
      compiled = Skia.RuntimeEffect.Make(DUST_SKSL);
    } catch {
      compiled = null;
    }
  }
  return compiled;
}

function namedUniforms(packed: Float32Array): DustUniforms {
  const named: Partial<DustUniforms> = {};
  let o = 0;
  for (let i = 0; i < DUST_UNIFORMS.length; i++) {
    const size = DUST_UNIFORM_SIZES[i]!;
    named[DUST_UNIFORMS[i]!] = size === 1 ? packed[o]! : Array.from(packed.subarray(o, o + size));
    o += size;
  }
  return named as DustUniforms;
}

/** For `modify`: the value was written in place, and this tells whoever reads it. */
function written<T>(value: T): T {
  'worklet';
  return value;
}

/**
 * Hide the grains the front has not reached: write alpha 0 into `colors` for each of the `count`
 * grains from sprite `first` whose release is later than `t`. Until then a grain would draw its
 * cell at home, over a place the shader may have dissolved already.
 */
function hideUnreleasedInto(
  state: Float32Array,
  count: number,
  t: number,
  colors: Float32Array,
  first: number,
): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    if (t < state[i * FRAG_STRIDE + DELAY]!) colors[(first + i) * 4 + 3] = 0;
  }
}

/**
 * The dissolve of one run: a rect that reaches `spread` beyond the element on every side, filled
 * by the dust shader with the capture as its child. It is a `<Shader>`, never the `RuntimeShader`
 * image filter, which the web does not implement (spec §3.3).
 *
 * The grains at the front mount nothing: the frame worklet writes the pool sprites the run
 * claimed, which the host's one `<Atlas>` draws (C38), and the host frees them when the run ends.
 */
function DustRect({
  run,
  preset,
  source,
  onFirstFrame,
  onDone,
}: EffectLayerProps & { preset: DustRunPreset; source: SkRuntimeEffect }): ReactNode {
  const { rect, image, hidden, startTime, progress, direction, spriteStart } = run;
  const { transforms, colors } = run.pool;
  const sprites = run.pool.rects;
  const dust = useMemo(() => createDustRun(preset, rect, image), [preset, rect, image]);
  const { samples, delay, duration, total } = dust;
  const { spread } = preset;
  // A run that claimed no sprite has no grains to write.
  const grains = spriteStart < 0 ? null : dust.grains;
  const count = grains?.fragments.mesh.count ?? 0;
  const state = grains?.fragments.state ?? NO_FLOATS;
  const phys = grains?.fragments.phys ?? NO_FLOATS;
  const cells = grains?.rects ?? NO_FLOATS;
  const pivots = grains?.pivots ?? NO_FLOATS;
  const grainSeconds = grains?.seconds ?? 0;
  const left = rect.x;
  const top = rect.y;
  const scale = 1 / image.pixelRatio;

  const uniforms = useSharedValue(useMemo(() => namedUniforms(dust.uniforms), [dust]));
  const ended = useSharedValue(false);

  const cut = <T extends Float32Array>(buffer: T): T => {
    'worklet';
    buffer.set(cells, spriteStart * 4);
    return buffer;
  };

  useFrameCallback((frame) => {
    'worklet';
    // The host frees the sprites once it hears of the end: nothing may write them after that.
    if (ended.value) return;
    const now = frame.timestamp / 1000;
    const first = startTime.value < 0;
    if (first) {
      startTime.value = now;
      if (count > 0) sprites.modify(cut);
    }
    let seconds = now - startTime.value;
    let over = false;
    if (progress !== undefined) seconds = progress.value * total;
    else if (seconds >= total) {
      seconds = total;
      over = true;
    }
    const eased = timingAt(samples, delay, duration, seconds);
    // An enter is the dissolve backwards: it starts gone and ends whole.
    const gone = direction === 1 ? 1 - eased : eased;

    // Written in place, as the sprites are: `modify` then marks the uniforms as changed.
    uniforms.value.u_progress = gone;
    uniforms.modify(written);

    if (count > 0) {
      const t = gone * grainSeconds;
      grainSpritesInto(
        state,
        phys,
        count,
        t,
        pivots,
        left,
        top,
        scale,
        transforms.value,
        colors.value,
        spriteStart,
      );
      hideUnreleasedInto(state, count, t, colors.value, spriteStart);
      transforms.modify(written);
      colors.modify(written);
    }

    if (first) handOff(hidden, onFirstFrame);
    if (!over) return;
    ended.value = true;
    // An enter ends whole: the element takes over on this same frame.
    if (direction === 1) hidden.value = 0;
    scheduleOnRN(onDone, true);
  });

  const corner = useMemo(
    () => [{ translateX: left - spread }, { translateY: top - spread }],
    [left, top, spread],
  );
  // Image pixels to layout pixels from the element's corner, where the shader samples.
  const sampling = useMemo(
    () => [{ translateX: -image.padding }, { translateY: -image.padding }, { scale }],
    [image.padding, scale],
  );

  return (
    // The shader measures from the rect's corner, so the group moves the origin there.
    <Group transform={corner}>
      <Rect x={0} y={0} width={rect.width + 2 * spread} height={rect.height + 2 * spread}>
        <Shader source={source} uniforms={uniforms}>
          {/* `captureView` puts an `SkImage` in `handle`. */}
          <ImageShader
            image={image.handle as SkImage | null}
            tx="decal"
            ty="decal"
            transform={sampling}
          />
        </Shader>
      </Rect>
    </Group>
  );
}

function DustLayer(props: EffectLayerProps): ReactNode {
  const { preset } = props.run;
  const source = dustSource();
  if (preset.kind !== 'dust' || source === null) return <Unplayed onDone={props.onDone} />;
  return <DustRect {...props} preset={preset} source={source} />;
}

const EFFECT: NativeEffect = {
  sprites(preset, rect, image) {
    return preset.kind === 'dust' ? dustGrainCount(preset, rect, image) : 0;
  },
  Layer: DustLayer,
};

/**
 * How `dust` draws on native, or `null` when the shader does not compile: the run then plays its
 * live fallback. A run claims a pool sprite per grain at its front, and none without grains.
 */
export function dustEffect(): NativeEffect | null {
  return dustSource() === null ? null : EFFECT;
}
