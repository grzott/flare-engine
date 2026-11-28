import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { CanvasKit } from 'canvaskit-wasm';
import { StrictMode } from 'react';
import { disintegrate, dust, emerge, shatter } from '../../src/core/presets';
import type { FxRuntime } from '../../src/runtime/contracts';
import type { FlareContextValue } from '../../src/runtime/provider-context';
import type { WebEffects } from '../../src/web/fx-runtime';
import { ContextProbe, settle, start } from '../fx/native/support';
import { flushFrames, installDom, pendingFrameCount, type Rendered, render } from '../support/dom';
import { type MockKit, makeMockKit } from '../support/mock-kit';

installDom();

const real = await import('@flare-engine/render-web');
let loadedKit: MockKit = makeMockKit();
const loadCanvasKit = mock(
  (_wasmUrl: string): Promise<CanvasKit> => Promise.resolve(loadedKit.kit),
);
mock.module('@flare-engine/render-web', () => ({ ...real, loadCanvasKit }));

// Loaded after the mock, so the host never reaches the real loader.
const { FlareFxHost, WebFxHost } = await import('../../src/fx/web/host');
const { FlareProvider } = await import('../../src/dom/provider');

const warn = spyOn(console, 'warn').mockImplementation(() => {});

/** Every preset draws the whole capture as one sprite, for ever. */
const effects: WebEffects = () => ({
  sprites: () => 1,
  frame(run, pool) {
    pool.srcs[2] = run.image.width;
    pool.srcs[3] = run.image.height;
    pool.xforms[0] = 1;
    return true;
  },
});

const rendered: Rendered[] = [];
const canvases = (): HTMLCanvasElement[] => [...document.body.querySelectorAll('canvas')];

beforeEach(() => {
  Reflect.set(globalThis, 'innerWidth', 400);
  Reflect.set(globalThis, 'innerHeight', 300);
  Reflect.set(globalThis, 'devicePixelRatio', 2);
  loadedKit = makeMockKit();
  loadCanvasKit.mockClear();
  warn.mockClear();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
  Reflect.deleteProperty(globalThis, 'CanvasKit');
});

interface Mounted {
  fx: FxRuntime;
  ctx(): FlareContextValue;
  view: Rendered;
}

function mount(
  o: { strict?: boolean; canvasKit?: CanvasKit; wasmUrl?: string; noEffects?: boolean } = {},
): Mounted {
  let seen: FlareContextValue | null = null;
  const probe = (
    <ContextProbe
      onContext={(ctx) => {
        seen = ctx;
      }}
    />
  );
  const tree =
    o.noEffects === true ? (
      <FlareFxHost canvasKit={o.canvasKit} wasmUrl={o.wasmUrl}>
        {probe}
      </FlareFxHost>
    ) : (
      <WebFxHost canvasKit={o.canvasKit} wasmUrl={o.wasmUrl} effects={effects}>
        {probe}
      </WebFxHost>
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

const unmount = (view: Rendered): void => {
  rendered.splice(rendered.indexOf(view), 1);
  view.unmount();
};

describe('FlareFxHost', () => {
  test('appends exactly one fixed canvas to body, which takes no pointer events', () => {
    const view = render(
      <FlareFxHost>
        <span data-testid="app" />
      </FlareFxHost>,
    );
    rendered.push(view);

    expect(view.container.querySelector('[data-testid="app"]')).not.toBeNull();
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(canvases()).toHaveLength(1);
    const canvas = canvases()[0]!;
    expect(canvas.parentElement).toBe(document.body);
    expect(canvas.style.pointerEvents).toBe('none');
    expect(canvas.style.position).toBe('fixed');
    // happy-dom keeps '0'; a browser reads it back as '0px'.
    expect(Number.parseFloat(canvas.style.inset)).toBe(0);
    // The backing store is in device pixels, so the box has to be pinned to the viewport.
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  test('StrictMode still leaves one canvas, and unmounting removes it', () => {
    const { view } = mount({ strict: true });
    expect(canvases()).toHaveLength(1);

    unmount(view);
    expect(canvases()).toHaveLength(0);
  });

  test('an idle host loads no CanvasKit and schedules no frame', async () => {
    mount({ wasmUrl: '/canvaskit.wasm' });
    await settle();
    await flushFrames(2);

    expect(loadCanvasKit).not.toHaveBeenCalled();
    expect(pendingFrameCount()).toBe(0);
  });

  test('provides the runtime and the nested-host factory, and keeps the rest of the context', () => {
    let seen: FlareContextValue | null = null;
    const view = render(
      <FlareProvider rtl>
        <FlareFxHost>
          <ContextProbe
            onContext={(ctx) => {
              seen = ctx;
            }}
          />
        </FlareFxHost>
      </FlareProvider>,
    );
    rendered.push(view);
    const ctx = seen as FlareContextValue | null;

    expect(typeof ctx?.fx?.run).toBe('function');
    expect(typeof ctx?.hostFactory).toBe('function');
    expect(ctx?.overlay).not.toBeNull();
    expect(ctx?.rtl).toBe(true);
  });

  test('the runtime is the same object on every render', () => {
    const { fx, ctx, view } = mount();
    view.rerender(
      <WebFxHost effects={effects}>
        <ContextProbe onContext={() => {}} />
      </WebFxHost>,
    );
    expect(ctx().fx).toBe(fx);
  });

  test('the nested-host factory mounts a second canvas', () => {
    const { ctx } = mount();
    const factory = ctx().hostFactory;
    if (factory === null) throw new Error('no factory');
    rendered.push(render(factory()));

    expect(canvases()).toHaveLength(2);
  });

  test('with no effect for a preset, the run falls back and no kit is loaded', async () => {
    const { fx } = mount({ noEffects: true, wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, emerge({ variant: 'shader' }));
    await settle();

    expect(events).toEqual(['fallback']);
    expect(loadCanvasKit).not.toHaveBeenCalled();
  });

  test('plays shatter with its own effect: a baked shard atlas', async () => {
    const { fx } = mount({ noEffects: true, wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    expect(loadedKit.offscreen).toHaveLength(1);
    expect(loadedKit.callsOf('drawAtlas')[0]?.args[0]).toBe(loadedKit.offscreen[0]?.snapshot);
  });

  test('plays a rectangular mesh as grains: cells of the capture, with no bake', async () => {
    for (const preset of [disintegrate(), shatter({ fragment: { pattern: 'grid' } })]) {
      loadedKit = makeMockKit();
      const { fx } = mount({ noEffects: true, wasmUrl: '/canvaskit.wasm' });
      const { events } = start(fx, preset);
      await settle();
      await flushFrames(1);

      expect(events).toEqual(['handoff']);
      expect(loadedKit.offscreen).toHaveLength(0);
      expect(loadedKit.callsOf('drawAtlas')).toHaveLength(1);
    }
  });

  test("disintegrate({ pattern: 'triangles' }) is shards: it bakes", async () => {
    const { fx } = mount({ noEffects: true, wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, disintegrate({ fragment: { pattern: 'triangles' } }));
    await settle();
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    expect(loadedKit.offscreen).toHaveLength(1);
  });

  test('plays dust with its own effect: a rect filled by the dust shader', async () => {
    const { fx } = mount({ noEffects: true, wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, dust());
    await settle();
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    expect(loadedKit.effects).toHaveLength(1);
    expect(loadedKit.callsOf('drawRect')).toHaveLength(1);
    expect(loadedKit.callsOf('drawAtlas')).toHaveLength(0);
  });
});

describe('the CanvasKit a host draws with', () => {
  test('is the canvasKit prop when given', async () => {
    const prop = makeMockKit();
    Reflect.set(globalThis, 'CanvasKit', makeMockKit().kit);
    const { fx } = mount({ canvasKit: prop.kit, wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    expect(prop.surfaces).toEqual([canvases()[0]]);
    expect(prop.callsOf('drawAtlas')).toHaveLength(1);
    expect(loadCanvasKit).not.toHaveBeenCalled();
  });

  test('is globalThis.CanvasKit when there is one, and loadCanvasKit is not called', async () => {
    const global = makeMockKit();
    Reflect.set(globalThis, 'CanvasKit', global.kit);
    const { fx } = mount({ wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    expect(global.callsOf('drawAtlas')).toHaveLength(1);
    expect(loadCanvasKit).not.toHaveBeenCalled();
  });

  test('is loaded from wasmUrl otherwise, on the first run', async () => {
    const { fx } = mount({ wasmUrl: '/canvaskit.wasm' });
    expect(loadCanvasKit).not.toHaveBeenCalled();

    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    expect(loadCanvasKit.mock.calls).toEqual([['/canvaskit.wasm']]);
    expect(events).toEqual(['handoff']);
    expect(loadedKit.callsOf('drawAtlas')).toHaveLength(1);
  });

  test('a rejected loadCanvasKit makes the run fall back', async () => {
    loadCanvasKit.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const { fx } = mount({ wasmUrl: '/canvaskit.wasm' });
    const { events, target } = start(fx, shatter());
    await settle();

    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(pendingFrameCount()).toBe(0);
  });

  test('loadCanvasKit rejecting with the number Infinity falls back, and the warning names the full binary', async () => {
    loadCanvasKit.mockImplementationOnce(() => Promise.reject(Number.POSITIVE_INFINITY));
    const { fx } = mount({ wasmUrl: '/canvaskit.wasm' });
    const { events } = start(fx, shatter());
    await settle();

    expect(events).toEqual(['fallback']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('bin/full/canvaskit.wasm');
  });
});

describe('a host that goes away', () => {
  test('ends a playing run unfinished', async () => {
    const { fx, view } = mount({ canvasKit: makeMockKit().kit });
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    unmount(view);

    expect(events).toEqual(['handoff', 'end:false']);
    expect(pendingFrameCount()).toBe(0);
  });

  test('a capture that lands afterwards draws nothing and ends unfinished', async () => {
    const kit = makeMockKit();
    const { fx, view } = mount({ canvasKit: kit.kit });
    const { target, events } = start(fx, shatter(), { deferCapture: true });
    await settle();

    unmount(view);
    target.landCaptures();
    await settle();

    expect(events).toEqual(['end:false']);
    expect(kit.calls).toEqual([]);
  });

  test('a run started afterwards ends unfinished, and appends no canvas', async () => {
    const { fx, view } = mount({ canvasKit: makeMockKit().kit });
    unmount(view);

    const { events, run } = start(fx, shatter());
    expect(events).toEqual([]);
    await settle();

    expect(events).toEqual(['end:false']);
    expect(run.cancel()).toBe(false);
    expect(canvases()).toHaveLength(0);
  });
});
