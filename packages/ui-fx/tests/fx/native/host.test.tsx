import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRef, StrictMode } from 'react';
import type { View } from 'react-native';
import { dust, shatter } from '../../../src/core/presets';
import type { FxRuntime } from '../../../src/runtime/contracts';
import type { FlareContextValue } from '../../../src/runtime/provider-context';
import { installDom, type Rendered, render } from '../../support/dom';
import { createFakeTarget } from '../../support/fakes';
import { installReanimatedMock } from '../../support/mock-reanimated';
import { installRnMock } from '../../support/mock-rn';
import { createMockImage, installSkiaMock } from '../../support/mock-skia';
import {
  ContextProbe,
  cancel,
  done,
  drawFirstFrame,
  firstFrame,
  layerEffects,
  layers,
  settle,
  start,
} from './support';

installDom();
const rn = installRnMock();
installReanimatedMock();
const skia = installSkiaMock();

// Loaded after the mocks, so the host never reaches the real Skia.
const { CAPTURE_PADDING, FlareFxHost, FxCaptureRoot, handOff, NativeFxHost } = await import(
  '../../../src/fx/native/host'
);
const { captureView } = await import('../../../src/fx/native/capture');

const rendered: Rendered[] = [];

beforeEach(() => {
  rn.reset();
  skia.reset();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
  layers.length = 0;
});

interface Mounted {
  fx: FxRuntime;
  ctx(): FlareContextValue;
  view: Rendered;
}

function mount(o: { strict?: boolean } = {}): Mounted {
  let seen: FlareContextValue | null = null;
  const tree = (
    <NativeFxHost effects={layerEffects()}>
      <ContextProbe
        onContext={(ctx) => {
          seen = ctx;
        }}
      />
    </NativeFxHost>
  );
  const view = render(o.strict === true ? <StrictMode>{tree}</StrictMode> : tree);
  rendered.push(view);
  const ctx = (): FlareContextValue => {
    if (seen === null) throw new Error('the probe never rendered');
    return seen;
  };
  const fx = ctx().fx;
  if (fx === null) throw new Error('the host provided no runtime');
  return { fx, ctx, view };
}

describe('FlareFxHost', () => {
  test('renders its children and one absolute-fill canvas that takes no touches', () => {
    const view = render(
      <FlareFxHost>
        <span data-testid="app" />
      </FlareFxHost>,
    );
    rendered.push(view);

    expect(view.container.querySelector('[data-testid="app"]')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-skia="canvas"]')).toHaveLength(1);
    // The canvas comes last, so it draws above the app.
    expect(view.container.lastElementChild?.getAttribute('data-skia')).toBe('canvas');
    expect(skia.canvas.mounts).toBe(1);
    expect(skia.canvas.props?.pointerEvents).toBe('none');
    expect(skia.canvas.props?.style).toEqual({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
  });

  test('provides the runtime and the nested-host factory, and keeps the rest of the context', () => {
    const { ctx } = mount();

    expect(typeof ctx().fx?.run).toBe('function');
    expect(typeof ctx().hostFactory).toBe('function');
    expect(ctx().overlay).toBeNull();
    expect(ctx().rtl).toBe(false);
  });

  test('the runtime is the same object on every render', () => {
    const { fx, ctx, view } = mount();
    view.rerender(
      <NativeFxHost effects={layerEffects()}>
        <ContextProbe onContext={() => {}} />
      </NativeFxHost>,
    );
    expect(ctx().fx).toBe(fx);
  });

  test('the nested-host factory mounts a second canvas', () => {
    const { ctx } = mount();
    const factory = ctx().hostFactory;
    if (factory === null) throw new Error('no factory');
    const nested = render(factory());
    rendered.push(nested);

    expect(skia.canvas.mounts).toBe(2);
  });

  test('passes the android surface options to the canvas, and omits them without any', () => {
    mount();
    expect(skia.canvas.props !== null && 'android' in skia.canvas.props).toBe(false);

    const android = { surfaceType: 'SurfaceView', zOrderOnTop: true } as const;
    rendered.push(render(<FlareFxHost android={android}>{null}</FlareFxHost>));
    expect(skia.canvas.props?.android).toEqual(android);
  });

  test('with no effect for a preset, the run falls back', async () => {
    let fx: FxRuntime | null = null;
    rendered.push(
      render(
        <FlareFxHost>
          <ContextProbe
            onContext={(ctx) => {
              fx = ctx.fx;
            }}
          />
        </FlareFxHost>,
      ),
    );
    if (fx === null) throw new Error('no runtime');
    const { events } = start(fx, dust());
    await settle();

    expect(events).toEqual(['fallback']);
  });
});

describe('a run', () => {
  test('measures, captures at 2048 px, mounts, hands off, ends and unmounts, in that order', async () => {
    const { fx } = mount();
    const preset = shatter();
    const { target, events } = start(fx, preset);

    expect(target.measures).toBe(1);
    expect(target.captures).toEqual([]);
    expect(layers).toHaveLength(0);

    await settle();
    expect(target.captures).toEqual([2048]);
    expect(layers).toHaveLength(1);
    const layer = layers[0]!;
    expect(layer.run.preset).toBe(preset);
    expect(layer.run.rect).toEqual({ x: 10, y: 20, width: 100, height: 40 });
    expect(layer.run.image).toBe(target.images[0]!);
    expect(layer.run.direction).toBe(-1);
    expect(layer.run.hidden).toBe(target.hidden);
    expect(layer.run.startTime.value).toBe(-1);
    expect(events).toEqual([]);
    expect(target.hidden.value).toBe(0);

    firstFrame(layer);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);

    done(layer, true);
    expect(events).toEqual(['handoff', 'end:true']);
    expect(layers).toHaveLength(0);
  });

  test('the first-frame worklet hides the target and reports to JS in one call', async () => {
    const { fx } = mount();
    const { target, events } = start(fx, shatter());
    await settle();
    const layer = layers[0]!;

    handOff(layer.run.hidden, () => {
      // `onHandoff` sees the target already hidden: the same tick, never a frame later.
      expect(target.hidden.value).toBe(1);
      layer.onFirstFrame();
    });

    expect(events).toEqual(['handoff']);
  });

  test('a capture that lands after the target unmounted mounts no layer and ends unfinished', async () => {
    const { fx } = mount();
    const { target, run, events } = start(fx, shatter(), { deferCapture: true });
    await settle();
    expect(target.captures).toEqual([2048]);

    // An unmounting element cancels its run.
    expect(cancel(run)).toBe(true);
    expect(events).toEqual([]);

    target.landCaptures();
    await settle();
    expect(layers).toHaveLength(0);
    expect(events).toEqual(['end:false']);
    expect(target.hidden.value).toBe(0);
  });

  test('a capture that lands after the host unmounted mounts no layer and ends unfinished', async () => {
    const { fx, view } = mount();
    const { target, events } = start(fx, shatter(), { deferCapture: true });
    await settle();

    rendered.splice(rendered.indexOf(view), 1);
    view.unmount();
    target.landCaptures();
    await settle();

    expect(layers).toHaveLength(0);
    expect(events).toEqual(['end:false']);
  });

  test('a capture that cannot be taken falls back once and never hands off', async () => {
    const { fx } = mount();
    const target = createFakeTarget();
    target.capture = (maxPx) => {
      target.captures.push(maxPx);
      return Promise.resolve(null);
    };
    const { events } = start(fx, shatter(), { target });
    await settle();

    expect(layers).toHaveLength(0);
    expect(events).toEqual(['fallback']);
  });

  test('a rejected makeImageFromView falls back once and never hands off', async () => {
    const { fx } = mount();
    const ref = { current: {} };
    const target = createFakeTarget();
    target.capture = (maxPx) => captureView(ref, maxPx, CAPTURE_PADDING);
    skia.nextImage = null;
    const { events } = start(fx, shatter(), { target });
    await settle();

    expect(skia.captured).toEqual([ref.current]);
    expect(layers).toHaveLength(0);
    expect(events).toEqual(['fallback']);
  });

  test('a target that measures null is never captured and falls back', async () => {
    const { fx } = mount();
    const target = createFakeTarget({ rect: null });
    const { events } = start(fx, shatter(), { target });
    await settle();

    expect(target.captures).toEqual([]);
    expect(events).toEqual(['fallback']);
  });

  test('a cancel between the UI-thread hide and onHandoff undoes the hide and ends the run', async () => {
    const { fx } = mount();
    const { target, run, events } = start(fx, shatter());
    await settle();
    const layer = layers[0]!;

    drawFirstFrame(layer);
    expect(target.hidden.value).toBe(1);

    expect(cancel(run)).toBe(true);
    expect(target.hidden.value).toBe(0);
    expect(layers).toHaveLength(0);
    expect(events).toEqual(['end:false']);

    // The first frame's report reaches JS late: the run is over, so nothing is handed off.
    layer.onFirstFrame();
    layer.onDone(true);
    expect(events).toEqual(['end:false']);
    expect(target.hidden.value).toBe(0);
  });

  test('a cancel after onHandoff returns false and leaves the run playing', async () => {
    const { fx } = mount();
    const { target, run, events } = start(fx, shatter());
    await settle();
    const layer = layers[0]!;
    firstFrame(layer);

    expect(cancel(run)).toBe(false);
    await settle();
    expect(layers).toHaveLength(1);
    expect(target.hidden.value).toBe(1);
    expect(events).toEqual(['handoff']);

    done(layer, true);
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test('a second cancel returns false and ends nothing twice', async () => {
    const { fx } = mount();
    const { run, events } = start(fx, shatter());
    await settle();

    expect(cancel(run)).toBe(true);
    expect(cancel(run)).toBe(false);
    expect(events).toEqual(['end:false']);
  });

  test('the host unmounting ends a playing run unfinished', async () => {
    const { fx, view } = mount();
    const { events } = start(fx, shatter());
    await settle();
    firstFrame(layers[0]!);

    rendered.splice(rendered.indexOf(view), 1);
    view.unmount();
    expect(events).toEqual(['handoff', 'end:false']);
  });

  test('the host unmounting before handoff shows the target again', async () => {
    const { fx, view } = mount();
    const { target, events } = start(fx, shatter());
    await settle();
    drawFirstFrame(layers[0]!);

    rendered.splice(rendered.indexOf(view), 1);
    view.unmount();
    expect(target.hidden.value).toBe(0);
    expect(events).toEqual(['end:false']);
  });

  test('runs under StrictMode', async () => {
    const { fx } = mount({ strict: true });
    const { events } = start(fx, shatter());
    await settle();
    expect(layers).toHaveLength(1);

    firstFrame(layers[0]!);
    done(layers[0]!, true);
    expect(events).toEqual(['handoff', 'end:true']);
  });
});

describe('captureView', () => {
  test('captures the view behind the ref and reports its size, pixel ratio and padding', async () => {
    rn.pixelRatio = 3;
    const handle = createMockImage(444, 276);
    skia.nextImage = handle;
    const ref = { current: {} };

    const image = await captureView(ref, 2048, 24);

    expect(skia.captured).toEqual([ref.current]);
    expect(image).toEqual({ width: 444, height: 276, pixelRatio: 3, padding: 24, handle });
    expect(skia.surfaces).toHaveLength(0);
    expect(handle.disposed).toBe(false);
  });

  test('downscales a 1080x1920 capture at pixel ratio 3 to 2048 px on its longer side', async () => {
    rn.pixelRatio = 3;
    const full = createMockImage(3240, 5760);
    skia.nextImage = full;

    const image = await captureView({ current: {} }, 2048, 24);

    expect(image).not.toBeNull();
    expect(Math.max(image!.width, image!.height)).toBe(2048);
    expect(image!.width).toBe(1152);
    // The image still covers the same layout box, so its pixel ratio shrinks with it.
    expect(image!.pixelRatio).toBeCloseTo((3 * 2048) / 5760, 10);
    expect(image!.padding).toBe(24);

    expect(skia.surfaces).toHaveLength(1);
    const surface = skia.surfaces[0]!;
    expect([surface.width, surface.height]).toEqual([1152, 2048]);
    expect(surface.draws).toHaveLength(1);
    const draw = surface.draws[0]!;
    expect(draw.image).toBe(full);
    expect([draw.src.x, draw.src.y, draw.src.width, draw.src.height]).toEqual([0, 0, 3240, 5760]);
    expect([draw.dest.x, draw.dest.y, draw.dest.width, draw.dest.height]).toEqual([
      0, 0, 1152, 2048,
    ]);
    expect(draw.filter).toBe(1);
    expect(image!.handle).toBe(surface.snapshot);
    // The full-size bitmap is tens of megabytes, so it is released at once.
    expect(full.disposed).toBe(true);
  });

  test('a wide capture is limited by its width', async () => {
    skia.nextImage = createMockImage(4096, 1000);
    const image = await captureView({ current: {} }, 2048, 0);
    expect([image!.width, image!.height]).toEqual([2048, 500]);
  });

  test('a capture at the limit is not redrawn', async () => {
    skia.nextImage = createMockImage(2048, 100);
    await captureView({ current: {} }, 2048, 0);
    expect(skia.surfaces).toHaveLength(0);
  });

  test('resolves null when makeImageFromView rejects', async () => {
    skia.nextImage = null;
    expect(await captureView({ current: {} }, 2048, 24)).toBeNull();
  });

  test('resolves null when the downscale surface cannot be made', async () => {
    skia.nextImage = createMockImage(3240, 5760);
    skia.failSurface = true;
    expect(await captureView({ current: {} }, 2048, 24)).toBeNull();
  });
});

describe('FxCaptureRoot', () => {
  test('is a view Fabric may not flatten, larger than its child by the padding on every side', () => {
    const ref = createRef<View>();
    const view = render(
      <FxCaptureRoot ref={ref} padding={24}>
        <span data-testid="element" />
      </FxCaptureRoot>,
    );
    rendered.push(view);

    const root = view.container.firstElementChild;
    expect<unknown>(ref.current).toBe(root);
    const props = rn.props(root);
    expect(props.collapsable).toBe(false);
    // The margin takes back what the padding adds, so the element stays where it was.
    expect(props.style).toEqual({ padding: 24, margin: -24 });
    expect(props.pointerEvents).toBe('box-none');
    expect(root?.querySelector('[data-testid="element"]')).not.toBeNull();
  });

  test('pads by 24 px unless told otherwise', () => {
    const view = render(<FxCaptureRoot ref={createRef<View>()}>{null}</FxCaptureRoot>);
    rendered.push(view);
    expect(CAPTURE_PADDING).toBe(24);
    expect(rn.props(view.container.firstElementChild).style).toEqual({ padding: 24, margin: -24 });
  });

  test('a capture through it is of the padded root, and carries the padding', async () => {
    const ref = createRef<View>();
    const view = render(
      <FxCaptureRoot ref={ref} padding={16}>
        <span />
      </FxCaptureRoot>,
    );
    rendered.push(view);
    skia.nextImage = createMockImage(132, 72);

    const image = await captureView(ref, 2048, 16);

    expect(skia.captured).toEqual([view.container.firstElementChild]);
    expect(image?.padding).toBe(16);
  });
});
