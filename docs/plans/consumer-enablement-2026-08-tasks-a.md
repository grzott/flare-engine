# Consumer-Enablement Plan A — math primitives, render-web hardening, hygiene

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the two `math` solver primitives that gate `@flare-engine/dynamics`, harden
`@flare-engine/render-web` to the bar its real consumer already runs at, and close three release
hygiene gaps.

**Architecture:** `render-web`'s `postfx-surface.ts` is a fork of `flare-engine-page`'s
`postfx/surface.ts` that was snapshotted before the page hardened it — but the engine has since
moved *ahead* on three axes the page lacks. This is therefore a **merge, not a copy**: take the
page's resilience (explicit GPU lifecycle, context loss/restore, `Src` blend, dimension clamping)
while preserving the engine's zero-alloc `rectScratch`, multi-child sampler support, direct
`Float32Array` uniforms, and caller-supplied chain. Copying the page's file wholesale is a
regression and must not be done.

**Tech Stack:** Bun, TypeScript strict, Biome, tsdown, Turborepo, Changesets (lockstep `fixed`),
`bun:test`, canvaskit-wasm.

**Spec:** [consumer-enablement-2026-08.md](consumer-enablement-2026-08.md) — W1, W2, W5.

## Global Constraints

- No `any`, no `as any`, no `@ts-ignore`, no `@ts-expect-error`.
- Named exports only. No default exports. `import type` for type-only imports.
- No `TODO` / `FIXME` comments. Comment only non-obvious logic.
- Zero-alloc in hot paths: no `new` inside per-frame code. Provide `out`-parameter forms alongside
  allocating forms where a value is consumed per frame.
- Conventional Commits, **≤72 chars**, no body, no emoji, **no `Co-Authored-By` trailer**.
- Builders never run `git add` / `git commit` / `git push` — commit steps below are emitted for the
  owner to run.
- Run `bun test` from the package directory after every code change.
- One lockstep **minor** changeset per row. Never `major` (it would force 1.0.0).
- Do not state a version number in any doc. Refer to "the next release".

---

### Task 1: `math` — `Vec2.perp` and `Vec2.crossSV`

Both are rigid-body solver primitives. `perp` is the 90° left-hand normal used to build contact
tangents; `crossSV` is the scalar×vector cross that turns an angular velocity into a linear
velocity at a contact offset. Confirmed absent from `packages/math/src/vec2.ts`.

**Files:**
- Modify: `packages/math/src/vec2.ts` (add to the `Vec2` namespace, after `cross` at `:109`)
- Test: `packages/math/tests/vec2.test.ts`
- Create: `.changeset/math-vec2-perp-crossmv.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `Vec2.perp(v: Vec2, out?: Vec2): Vec2` — returns `{ x: -v.y, y: v.x }`.
  `Vec2.crossSV(s: number, v: Vec2, out?: Vec2): Vec2` — returns `{ x: -s * v.y, y: s * v.x }`.
  Both used by `@flare-engine/dynamics` in Plan B.

- [ ] **Step 1: Write the failing tests**

Append to `packages/math/tests/vec2.test.ts`:

```ts
describe('Vec2.perp', () => {
  it('rotates 90 degrees counter-clockwise in screen space', () => {
    expect(Vec2.perp({ x: 1, y: 0 })).toEqual({ x: 0, y: 1 });
    expect(Vec2.perp({ x: 0, y: 1 })).toEqual({ x: -1, y: 0 });
  });

  it('is orthogonal to its input', () => {
    const v = { x: 3, y: -7 };
    expect(Vec2.dot(v, Vec2.perp(v))).toBe(0);
  });

  it('preserves length', () => {
    const v = { x: 3, y: 4 };
    expect(Vec2.length(Vec2.perp(v))).toBeCloseTo(5, 12);
  });

  it('writes into out and returns it without allocating', () => {
    const out = { x: 0, y: 0 };
    const r = Vec2.perp({ x: 2, y: 5 }, out);
    expect(r).toBe(out);
    expect(out).toEqual({ x: -5, y: 2 });
  });

  it('aliases safely when out is the input', () => {
    const v = { x: 2, y: 5 };
    Vec2.perp(v, v);
    expect(v).toEqual({ x: -5, y: 2 });
  });
});

describe('Vec2.crossSV', () => {
  it('computes the scalar-cross-vector product', () => {
    expect(Vec2.crossSV(2, { x: 3, y: 4 })).toEqual({ x: -8, y: 6 });
  });

  it('equals perp scaled by s', () => {
    const v = { x: 3, y: -4 };
    const s = 2.5;
    expect(Vec2.crossSV(s, v)).toEqual(Vec2.scale(Vec2.perp(v), s));
  });

  it('returns zero for a zero scalar', () => {
    expect(Vec2.crossSV(0, { x: 3, y: 4 })).toEqual({ x: -0, y: 0 });
  });

  it('writes into out and returns it without allocating', () => {
    const out = { x: 0, y: 0 };
    const r = Vec2.crossSV(3, { x: 1, y: 2 }, out);
    expect(r).toBe(out);
    expect(out).toEqual({ x: -6, y: 3 });
  });

  it('aliases safely when out is the input vector', () => {
    const v = { x: 1, y: 2 };
    Vec2.crossSV(3, v, v);
    expect(v).toEqual({ x: -6, y: 3 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/math && bun test tests/vec2.test.ts`
Expected: FAIL — `Vec2.perp is not a function`, `Vec2.crossSV is not a function`.

- [ ] **Step 3: Implement**

In `packages/math/src/vec2.ts`, insert immediately after the `cross` method (`:109-111`):

```ts
  /** Left-hand perpendicular (90° CCW in screen space): (-y, x). Writes into out if provided. */
  perp(v: Vec2, out?: Vec2): Vec2 {
    const x = -v.y;
    const y = v.x;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },

  /** Scalar × vector cross product: s × v = (-s·y, s·x). Writes into out if provided. */
  crossSV(s: number, v: Vec2, out?: Vec2): Vec2 {
    const x = -s * v.y;
    const y = s * v.x;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },
```

The locals are load-bearing: reading both components before writing either is what makes the
aliasing tests (`out === v`) pass.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/math && bun test tests/vec2.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Verify the exports and gate**

Run: `cd packages/math && bun run lint && bun run typecheck && bun test`
Expected: all green. `Vec2` is a namespace object exported from `src/index.ts`; no index edit is
needed since the methods hang off the existing `Vec2` const.

- [ ] **Step 6: Write the changeset**

Create `.changeset/math-vec2-perp-crossmv.md`:

```markdown
---
'@flare-engine/math': minor
---

Add `Vec2.perp` and `Vec2.crossSV` rigid-body solver primitives, both with `out` forms.
```

- [ ] **Step 7: Commit**

```bash
git add packages/math/src/vec2.ts packages/math/tests/vec2.test.ts .changeset/math-vec2-perp-crossmv.md
git commit -m "feat(math): add Vec2.perp and Vec2.crossSV with out forms"
```

---

### Task 2: `render-web` — extract a shared mock-kit test helper

**Pure test refactor, no `src/` change.** `postfx-surface.test.ts` builds a fake `CanvasKit` inline
in four places (`makeMockKit` `:59`, the resize test `:185`, the dispose test `:285`,
`makeRuntimeSupportedKit` `:398`). Task 3 replaces `MakeWebGLCanvasSurface` with three different
methods, which would otherwise mean editing four mocks by hand and getting a confusing multi-failure
run. Centralise first so Task 3 edits exactly one place.

**Files:**
- Create: `packages/render-web/tests/support/mock-kit.ts`
- Modify: `packages/render-web/tests/postfx-surface.test.ts`

**Interfaces:**
- Produces: `makeMockKit(opts?: MockKitOptions): MockKit` where
  `MockKit = { kit: CanvasKit; calls: CallRecord[]; deletedSurfaces: number[]; deletedPaints: string[]; childrenCounts: number[]; onscreenCount: number }`
  and `MockKitOptions = { runtimeSupported?: boolean }`. Task 3 and Task 4 both extend this file.

- [ ] **Step 1: Create the shared helper**

Create `packages/render-web/tests/support/mock-kit.ts`. Consolidate the four inline mocks into one
factory, preserving every behaviour the current tests rely on: tracked surface deletes, tracked
paint deletes, per-pass children counts, and a `RuntimeEffect` that can be present or absent.

```ts
import type { CanvasKit, Canvas as CKCanvas, Image as CKImage, Surface } from 'canvaskit-wasm';

export type CallRecord = { method: string; args?: unknown[] };

export interface MockKitOptions {
  /** When true, RuntimeEffect.Make returns a working fake so multi-pass blit runs. */
  runtimeSupported?: boolean;
}

export interface MockKit {
  kit: CanvasKit;
  calls: CallRecord[];
  deletedSurfaces: number[];
  deletedPaints: string[];
  deletedShaders: string[];
  deletedSrcShaders: string[];
  deletedSnapshots: string[];
  childrenCounts: number[];
  /** How many on-screen surfaces have been created (one per build + one per resize). */
  onscreenCount: () => number;
}

export function makeMockKit(opts: MockKitOptions = {}): MockKit {
  const calls: CallRecord[] = [];
  const deletedSurfaces: number[] = [];
  const deletedPaints: string[] = [];
  const deletedShaders: string[] = [];
  const deletedSrcShaders: string[] = [];
  const deletedSnapshots: string[] = [];
  const childrenCounts: number[] = [];
  let surfaceId = 0;
  let shaderIdx = 0;
  let snapshotIdx = 0;
  let onscreenCount = 0;

  const makeSnapshot = (label: string): CKImage =>
    ({
      makeShaderOptions: () => ({
        delete: () => deletedSrcShaders.push(`src-${label}`),
      }),
      delete: () => deletedSnapshots.push(label),
    }) as unknown as CKImage;

  function makeSurface(): Surface {
    const id = ++surfaceId;
    return {
      getCanvas: () =>
        ({
          save: () => 0,
          restore: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          concat: () => {},
          clear: (c: unknown) => calls.push({ method: 'clear', args: [c] }),
          drawImage: (img: unknown, x: number, y: number) =>
            calls.push({ method: 'drawImage', args: [img, x, y] }),
          drawRect: (r: unknown, p: unknown) => calls.push({ method: 'drawRect', args: [r, p] }),
        }) as unknown as CKCanvas,
      flush: () => {},
      delete: () => deletedSurfaces.push(id),
      makeImageSnapshot: () => makeSnapshot(`snap-${++snapshotIdx}`),
      makeSurface: () => makeSurface(),
    } as unknown as Surface;
  }

  const fakeEffect = {
    makeShaderWithChildren: (_uniforms: ArrayLike<number>, children: unknown[]) => {
      childrenCounts.push(children.filter((c) => c != null).length);
      const label = `shader-${++shaderIdx}`;
      return { delete: () => deletedShaders.push(label) };
    },
  };

  const kit = {
    MakeWebGLCanvasSurface: () => {
      onscreenCount++;
      return makeSurface();
    },
    ColorType: { RGBA_8888: 0 },
    AlphaType: { Premul: 1 },
    ColorSpace: { SRGB: null },
    BlendMode: { SrcOver: {}, Src: {} },
    TileMode: { Clamp: 0 },
    FilterMode: { Linear: 0 },
    MipmapMode: { None: 0 },
    Paint: class {
      private _label = `paint-${deletedPaints.length}`;
      setColor() {}
      setBlendMode() {}
      setShader() {}
      delete() {
        deletedPaints.push(this._label);
      }
    },
    RuntimeEffect: { Make: () => (opts.runtimeSupported ? fakeEffect : null) },
    Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
    LTRBRect: (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b]),
  } as unknown as CanvasKit;

  return {
    kit,
    calls,
    deletedSurfaces,
    deletedPaints,
    deletedShaders,
    deletedSrcShaders,
    deletedSnapshots,
    childrenCounts,
    onscreenCount: () => onscreenCount,
  };
}
```

- [ ] **Step 2: Rewrite the test file to use it**

In `packages/render-web/tests/postfx-surface.test.ts`, delete the local `makeMockSurface`
(`:30-57`), `makeMockKit` (`:59-86`), the inline kit in the resize test (`:161-222`), the inline
kit in the dispose test (`:256-319`), and `makeRuntimeSupportedKit` (`:327-421`). Import the shared
helper instead:

```ts
import { makeMockKit } from './support/mock-kit.js';
```

Rewire the assertions to the new field names — the mappings are:

| Old local | New |
|---|---|
| `const { kit } = makeMockKit()` | unchanged |
| `onscreenCalls` | `calls` |
| `mkWebGLCallCount` | `onscreenCount()` |
| `initialOnscreenDeleted` | `deletedSurfaces.includes(1)` |
| `makeRuntimeSupportedKit()` | `makeMockKit({ runtimeSupported: true })` |

Keep every existing `it(...)` block and its assertions. The real-CanvasKit `describe` at `:507`
is untouched.

- [ ] **Step 3: Run the tests to verify nothing changed**

Run: `cd packages/render-web && bun test tests/postfx-surface.test.ts`
Expected: PASS — the same test count as before the refactor. If any test fails, the refactor
changed behaviour and must be corrected before proceeding; no `src/` file has been touched, so a
failure here is purely a mock-fidelity bug.

- [ ] **Step 4: Commit**

```bash
git add packages/render-web/tests/support/mock-kit.ts packages/render-web/tests/postfx-surface.test.ts
git commit -m "test(render-web): extract a shared mock CanvasKit helper"
```

---

### Task 3: `render-web` — explicit WebGL context lifecycle

The load-bearing fix. `createPostFxSurface` builds via `kit.MakeWebGLCanvasSurface(canvas)`
(`postfx-surface.ts:57`), which hides the WebGL context handle, so `dispose()` (`:232-239`) can
never free the `GrDirectContext` or the context itself. Every surface leaks one live WebGL context.
Browsers cap live contexts and force-lose the oldest, so a host that swaps scenes — exactly what
`flare-engine-page` does across five animations — degrades until reload.

Take explicit ownership: `GetWebGLContext` → `MakeWebGLContext` → `MakeOnScreenGLSurface`.

**Files:**
- Modify: `packages/render-web/src/postfx-surface.ts`
- Modify: `packages/render-web/tests/support/mock-kit.ts`
- Modify: `packages/render-web/tests/postfx-surface.test.ts`

**Interfaces:**
- Consumes: `makeMockKit` from Task 2.
- Produces: `PostFxSurface.isLost(): boolean` (**additive**);
  `PostFxSurface.onscreenCanvas(): CKCanvas | null` (**breaking** — was non-nullable).
  Internal `buildGpu(): boolean` and `disposeGpu(): void` are consumed by Task 4.

- [ ] **Step 1: Teach the mock the explicit-context API**

In `packages/render-web/tests/support/mock-kit.ts`, add to the `MockKit` interface:

```ts
  deletedContexts: number[];
  deletedGrContexts: number[];
  /** Force the next buildGpu() to fail, simulating a GPU that cannot allocate. */
  failNextBuild: (v: boolean) => void;
```

and in `makeMockKit`, replace the `MakeWebGLCanvasSurface` entry with:

```ts
    GetWebGLContext: () => (failBuild ? 0 : ++ctxId),
    MakeWebGLContext: (handle: number) => {
      if (failBuild) return null;
      const id = handle;
      return { delete: () => deletedGrContexts.push(id) };
    },
    MakeOnScreenGLSurface: () => {
      if (failBuild) return null;
      onscreenCount++;
      return makeSurface();
    },
    deleteContext: (handle: number) => deletedContexts.push(handle),
```

with these declared alongside the other counters:

```ts
  const deletedContexts: number[] = [];
  const deletedGrContexts: number[] = [];
  let ctxId = 0;
  let failBuild = false;
```

and returned as `deletedContexts`, `deletedGrContexts`,
`failNextBuild: (v: boolean) => { failBuild = v; }`.

Keep `MakeWebGLCanvasSurface` in the mock for now — `web-surface.ts` still uses it and its tests
must keep passing.

- [ ] **Step 2: Write the failing tests**

Add to `packages/render-web/tests/postfx-surface.test.ts`:

```ts
describe('explicit WebGL context lifecycle', () => {
  it('dispose frees the GrDirectContext and the WebGL context handle', () => {
    const m = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(surface).not.toBeNull();
    expect(m.deletedContexts).toEqual([]);

    surface.dispose();

    expect(m.deletedGrContexts.length).toBe(1);
    expect(m.deletedContexts.length).toBe(1);
  });

  it('does not leak a context per surface across create/dispose cycles', () => {
    const m = makeMockKit();
    for (let i = 0; i < 8; i++) {
      const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
      createPostFxSurface(m.kit, canvas, new EffectChain())!.dispose();
    }
    expect(m.deletedContexts.length).toBe(8);
    expect(m.deletedGrContexts.length).toBe(8);
  });

  it('returns null and leaks nothing when the GPU cannot build', () => {
    const m = makeMockKit();
    m.failNextBuild(true);
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    expect(createPostFxSurface(m.kit, canvas, new EffectChain())).toBeNull();
    expect(m.deletedContexts.length).toBe(0);
  });

  it('reports isLost false on a healthy surface', () => {
    const m = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(surface.isLost()).toBe(false);
    expect(surface.onscreenCanvas()).not.toBeNull();
  });

  it('resize rebuilds the on-screen surface from the retained GrDirectContext', () => {
    const m = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(m.onscreenCount()).toBe(1);

    surface.resize(200, 150);

    expect(m.onscreenCount()).toBe(2);
    expect(surface.width).toBe(200);
    expect(surface.height).toBe(150);
    // The context is retained across resize — only surfaces are rebuilt.
    expect(m.deletedContexts.length).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/render-web && bun test tests/postfx-surface.test.ts`
Expected: FAIL — `surface.isLost is not a function`, and the context-delete assertions fail because
`kit.deleteContext` is never called.

- [ ] **Step 4: Implement the lifecycle**

In `packages/render-web/src/postfx-surface.ts`:

Extend the type import at `:7` to carry the two new CanvasKit types:

```ts
import type {
  CanvasKit,
  Canvas as CKCanvas,
  GrDirectContext,
  Shader,
  Surface,
  WebGLContextHandle,
} from 'canvaskit-wasm';
```

Change the two interface members (`:26-28`) and add `isLost`:

```ts
  /** The offscreen scene canvas — draw the scene here each frame. Null while the context is lost. */
  sceneCanvas(): CKCanvas | null;
  /** The on-screen canvas — draw crisp overlays here AFTER composite(). Null while lost. */
  onscreenCanvas(): CKCanvas | null;
```

and, next to `dispose()` (`:39`):

```ts
  /** True while the WebGL context is lost or GPU surfaces could not be allocated. */
  isLost(): boolean;
```

Replace the construction block (`:57-76`) with clamped dimensions and grouped GPU state:

```ts
  const clampDim = (v: number): number => {
    const n = Math.floor(v);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  let w = clampDim(canvas.width);
  let h = clampDim(canvas.height);
  let lastBg: readonly number[] = [0, 0, 0];

  const info = () => ({
    width: w,
    height: h,
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Premul,
    colorSpace: kit.ColorSpace.SRGB,
  });

  let ctxHandle: WebGLContextHandle = 0;
  let grContext: GrDirectContext | null = null;
  let onscreen: Surface | null = null;
  let scene: Surface | null = null;
  let pong: Surface | null = null;
  let lost = false;

  // Frees every GPU object. Null-safe: runs on partial construction and on every restore.
  const disposeGpu = (): void => {
    scene?.delete();
    pong?.delete();
    onscreen?.delete();
    grContext?.delete();
    if (ctxHandle) kit.deleteContext(ctxHandle);
    scene = null;
    pong = null;
    onscreen = null;
    grContext = null;
    ctxHandle = 0;
  };

  // (Re)creates context + surfaces on the current canvas at w×h. False if the GPU cannot.
  const buildGpu = (): boolean => {
    ctxHandle = kit.GetWebGLContext(canvas);
    if (!ctxHandle) return false;
    grContext = kit.MakeWebGLContext(ctxHandle);
    if (!grContext) {
      kit.deleteContext(ctxHandle);
      ctxHandle = 0;
      return false;
    }
    onscreen = kit.MakeOnScreenGLSurface(grContext, w, h, kit.ColorSpace.SRGB);
    scene = onscreen?.makeSurface(info()) ?? null;
    pong = onscreen?.makeSurface(info()) ?? null;
    if (!onscreen || !scene || !pong) {
      disposeGpu();
      return false;
    }
    return true;
  };

  if (!buildGpu()) {
    disposeGpu();
    return null;
  }

  const clearScene = (bgRgb: readonly number[]): void => {
    lastBg = bgRgb;
    const sc = scene?.getCanvas();
    if (!sc) return;
    sc.clear(kit.Color4f(bgRgb[0] ?? 0, bgRgb[1] ?? 0, bgRgb[2] ?? 0, 1));
    scene?.flush();
  };
```

Guard `blit` — insert as its first statement (before `:103`):

```ts
    if (lost || !onscreen) return;
```

**Preserve the rest of `blit` exactly as written.** The `rectScratch` reuse, the `childrenBuf`
in-place resize, the Convention-A child ordering, and passing `pass.uniforms` directly are all
engine work the page's version does not have. Do not replace them with the page's
`kit.LTRBRect(...)`, `[srcShader]`, or `Float32Array.from(...)`.

Replace the returned object's members that touch GPU state:

```ts
    sceneCanvas: () => (lost ? null : (scene?.getCanvas() ?? null)),
    onscreenCanvas: () => (lost ? null : (onscreen?.getCanvas() ?? null)),
    clear(bgRgb) {
      clearScene(bgRgb);
    },
```

In `fadeTrail`, change the guard (`:183-184`) to `if (lost || !sc) return;`.
In `composite`, change the guard (`:198`) to `if (lost || !scene) return;`.
Replace `flush` (`:205-207`) with `flush() { if (!lost) onscreen?.flush(); }`.

Replace `resize` (`:208-231`) — it now rebuilds from the retained `grContext` instead of calling
`MakeWebGLCanvasSurface` again:

```ts
    resize(nextW, nextH) {
      w = clampDim(nextW);
      h = clampDim(nextH);
      canvas.width = w;
      canvas.height = h;
      if (lost || !grContext) return; // a pending restore rebuilds at the new size
      scene?.delete();
      pong?.delete();
      onscreen?.delete();
      onscreen = kit.MakeOnScreenGLSurface(grContext, w, h, kit.ColorSpace.SRGB);
      scene = onscreen?.makeSurface(info()) ?? null;
      pong = onscreen?.makeSurface(info()) ?? null;
      if (!onscreen || !scene || !pong) {
        disposeGpu();
        lost = true;
      }
    },
```

Replace `dispose` (`:232-239`) and add `isLost`:

```ts
    isLost: () => lost,
    dispose() {
      fade.delete();
      fx.delete();
      runtime.reset();
      disposeGpu();
    },
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd packages/render-web && bun test tests/postfx-surface.test.ts`
Expected: PASS. The pre-existing `returns null when MakeWebGLCanvasSurface fails` test at `:114`
now tests the wrong thing — rewrite it to drive the new path:

```ts
  it('returns null when the WebGL context cannot be acquired', () => {
    const kit = { GetWebGLContext: () => 0 } as unknown as CanvasKit;
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    expect(createPostFxSurface(kit, canvas, new EffectChain())).toBeNull();
  });
```

- [ ] **Step 6: Run the full package gate**

Run: `cd packages/render-web && bun run lint && bun run typecheck && bun test`
Expected: all green. `typecheck` is where a missed `onscreen` null-guard surfaces.

- [ ] **Step 7: Commit**

```bash
git add packages/render-web/src/postfx-surface.ts packages/render-web/tests/
git commit -m "fix(render-web): own the WebGL context so dispose frees it"
```

---

### Task 4: `render-web` — context loss and restore self-heal

Without this, a runtime context loss blanks the host until reload. `preventDefault()` on the loss
event is what makes the context restorable at all — omitting it is the single most common way this
is implemented wrongly.

**Files:**
- Modify: `packages/render-web/src/postfx-surface.ts`
- Modify: `packages/render-web/tests/postfx-surface.test.ts`

**Interfaces:**
- Consumes: `buildGpu()`, `disposeGpu()`, `lost`, `lastBg`, `clearScene()` from Task 3.
- Produces: no new public surface; `isLost()` becomes dynamic.

- [ ] **Step 1: Write the failing tests**

The mock canvas needs real event plumbing. Add to `postfx-surface.test.ts`:

```ts
function makeEventfulCanvas(width = 100, height = 100): HTMLCanvasElement & {
  fire: (type: string) => Event;
  listenerCount: () => number;
} {
  const listeners = new Map<string, Set<EventListener>>();
  const canvas = {
    width,
    height,
    addEventListener(type: string, fn: EventListener) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: EventListener) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string) {
      let defaultPrevented = false;
      const ev = {
        type,
        preventDefault: () => {
          defaultPrevented = true;
        },
        get defaultPrevented() {
          return defaultPrevented;
        },
      } as unknown as Event;
      for (const fn of listeners.get(type) ?? []) fn(ev);
      return ev;
    },
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
  return canvas as unknown as HTMLCanvasElement & {
    fire: (type: string) => Event;
    listenerCount: () => number;
  };
}

describe('WebGL context loss and restore', () => {
  it('calls preventDefault on loss so the context stays restorable', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    createPostFxSurface(m.kit, canvas, new EffectChain())!;
    const ev = canvas.fire('webglcontextlost');
    expect(ev.defaultPrevented).toBe(true);
  });

  it('reports lost and nulls both canvases while lost', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    expect(surface.isLost()).toBe(true);
    expect(surface.sceneCanvas()).toBeNull();
    expect(surface.onscreenCanvas()).toBeNull();
  });

  it('no-ops draw operations while lost instead of throwing', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    expect(() => {
      surface.clear([0, 0, 0]);
      surface.fadeTrail([0, 0, 0], 0.5);
      surface.composite(1);
      surface.flush();
    }).not.toThrow();
  });

  it('rebuilds GPU objects on restore and clears to the last background', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    surface.clear([0.25, 0.5, 0.75]);
    const clearsBefore = m.calls.filter((c) => c.method === 'clear').length;

    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');

    expect(surface.isLost()).toBe(false);
    expect(surface.sceneCanvas()).not.toBeNull();
    // The restore re-cleared to the retained background rather than to black.
    const clearsAfter = m.calls.filter((c) => c.method === 'clear').length;
    expect(clearsAfter).toBe(clearsBefore + 1);
    const lastClear = m.calls.filter((c) => c.method === 'clear').at(-1);
    expect(Array.from(lastClear!.args![0] as Float32Array)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('stays lost when the GPU still cannot build on restore', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    m.failNextBuild(true);
    canvas.fire('webglcontextrestored');
    expect(surface.isLost()).toBe(true);
  });

  it('removes both listeners on dispose', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(canvas.listenerCount()).toBe(2);
    surface.dispose();
    expect(canvas.listenerCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/render-web && bun test tests/postfx-surface.test.ts`
Expected: FAIL — `defaultPrevented` is false and `isLost()` stays false, because no listeners are
registered.

- [ ] **Step 3: Implement**

In `packages/render-web/src/postfx-surface.ts`, after `clearScene` and before the returned object,
add the handlers and register them:

```ts
  // preventDefault() keeps the context restorable; `lost` gates every draw op so nothing touches a
  // dead context. On restore, rebuild on the same canvas and re-clear to the retained background.
  const onContextLost = (e: Event): void => {
    e.preventDefault();
    lost = true;
  };
  const onContextRestored = (): void => {
    disposeGpu();
    lost = !buildGpu();
    if (!lost) clearScene(lastBg);
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);
```

Extend `dispose()` to unregister them first:

```ts
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
      fade.delete();
      fx.delete();
      runtime.reset();
      disposeGpu();
    },
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd packages/render-web && bun test tests/postfx-surface.test.ts`
Expected: PASS.

Note the existing tests construct canvases as bare `{ width, height }` object literals with no
`addEventListener`. Those now throw. Update every such literal in the file to
`makeEventfulCanvas(w, h)`.

- [ ] **Step 5: Run the full package gate**

Run: `cd packages/render-web && bun run lint && bun run typecheck && bun test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/render-web/src/postfx-surface.ts packages/render-web/tests/postfx-surface.test.ts
git commit -m "fix(render-web): self-heal on webgl context loss and restore"
```

---

### Task 5: `render-web` — `Src` blend on the composite blit

The `fx` paint is created at `postfx-surface.ts:79` and never has a blend mode set, so it inherits
`SrcOver`. The pass blit is a full-frame **replace**, so leftover pong content can bleed through
between passes. One line, but it needs a test that would actually catch its absence.

**Files:**
- Modify: `packages/render-web/src/postfx-surface.ts`
- Modify: `packages/render-web/tests/support/mock-kit.ts`
- Modify: `packages/render-web/tests/postfx-surface.test.ts`

**Interfaces:**
- Consumes: `makeMockKit` from Task 2.
- Produces: nothing public.

- [ ] **Step 1: Record blend modes in the mock**

In `mock-kit.ts`, add `blendModes: unknown[]` to `MockKit`, declare `const blendModes: unknown[] = []`,
change the `Paint` class's `setBlendMode` to `setBlendMode(m: unknown) { blendModes.push(m); }`,
and return `blendModes`. Give `BlendMode` distinguishable identities:

```ts
    BlendMode: { SrcOver: { name: 'SrcOver' }, Src: { name: 'Src' } },
```

- [ ] **Step 2: Write the failing test**

```ts
describe('composite blit blend mode', () => {
  it('sets Src on the fx paint so passes replace rather than blend', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    createPostFxSurface(m.kit, canvas, new EffectChain())!;
    // The fx paint is configured at construction, before any draw.
    expect(m.blendModes).toContainEqual({ name: 'Src' });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd packages/render-web && bun test tests/postfx-surface.test.ts`
Expected: FAIL — no `Src` was ever set; only `fadeTrail` sets `SrcOver`, and only when called.

- [ ] **Step 4: Implement**

In `packages/render-web/src/postfx-surface.ts`, immediately after `const fx = new kit.Paint();`:

```ts
  // Full-frame replace-blit: never composite stale pong content from a previous pass.
  fx.setBlendMode(kit.BlendMode.Src);
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd packages/render-web && bun run lint && bun run typecheck && bun test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/render-web/src/postfx-surface.ts packages/render-web/tests/
git commit -m "fix(render-web): set Src blend mode on the postfx blit paint"
```

---

### Task 6: `render-web` — loader resilience

`loader.ts:24` assigns `pending = init(...)` and never clears it on rejection, so one transient
failure disables CanvasKit for the module's lifetime and every retry re-awaits the same rejection.
There is also no stall abort and no deadline, so a hung stream leaves a progress bar frozen forever.

Keep the engine's `wasmUrl` parameter and its Node `fs` fallback — the page's version hardcodes a
Vite `?url` import and has no Node path, and the engine's tests depend on both.

**Files:**
- Modify: `packages/render-web/src/loader.ts`
- Test: `packages/render-web/tests/loader.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `loadCanvasKit(wasmUrl: string, onProgress?: (fraction: number) => void): Promise<CanvasKit>`
  — signature unchanged; failure behaviour changed from permanently-poisoned to retryable.

- [ ] **Step 1: Write the failing tests**

Add to `packages/render-web/tests/loader.test.ts`. The module caches in a module-level `pending`,
so each test needs a fresh module registry — `bun:test` gives that via a dynamic import with a
cache-busting query.

```ts
import { afterEach, describe, expect, it } from 'bun:test';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function freshLoader(): Promise<typeof import('../src/loader.js')> {
  return import(`../src/loader.js?t=${Math.random()}`);
}

describe('loadCanvasKit resilience', () => {
  it('clears the cached promise on failure so a later call retries', async () => {
    const { loadCanvasKit } = await freshLoader();
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      return Promise.reject(new Error('network down'));
    }) as typeof fetch;

    await loadCanvasKit('/nope/canvaskit.wasm').catch(() => {});
    const firstCalls = calls;
    await loadCanvasKit('/nope/canvaskit.wasm').catch(() => {});

    // A poisoned cache would replay the rejection without re-fetching.
    expect(calls).toBeGreaterThan(firstCalls);
  });

  it('rejects when the load exceeds the deadline', async () => {
    const { loadCanvasKit } = await freshLoader();
    globalThis.fetch = (() => new Promise<Response>(() => {})) as typeof fetch;

    await expect(
      loadCanvasKit('/hang/canvaskit.wasm', undefined, { deadlineMs: 40, stallMs: 20 }),
    ).rejects.toThrow(/exceeded/);
  });

  it('aborts a stalled stream', async () => {
    const { loadCanvasKit } = await freshLoader();
    let aborted = false;
    globalThis.fetch = ((_u: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<Response>(() => {});
    }) as typeof fetch;

    await loadCanvasKit('/stall/canvaskit.wasm', undefined, {
      stallMs: 20,
      deadlineMs: 200,
    }).catch(() => {});

    expect(aborted).toBe(true);
  });

  it('reports indeterminate progress when Content-Length is absent', async () => {
    const { loadCanvasKit } = await freshLoader();
    const fractions: number[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(1_000_000));
        c.enqueue(new Uint8Array(1_000_000));
        c.close();
      },
    });
    globalThis.fetch = (() =>
      Promise.resolve({ ok: true, body, headers: new Headers() } as Response)) as typeof fetch;

    await loadCanvasKit('/nolen/canvaskit.wasm', (f) => fractions.push(f)).catch(() => {});

    // Without a length the bar must creep, not sit at 0 and jump to 1.
    const mid = fractions.filter((f) => f > 0 && f < 1);
    expect(mid.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/render-web && bun test tests/loader.test.ts`
Expected: FAIL — the retry test sees no second fetch, and the options argument does not exist.

- [ ] **Step 3: Implement**

Rewrite `packages/render-web/src/loader.ts`, preserving the Node `fs` branch:

```ts
import type { CanvasKit } from 'canvaskit-wasm';

type CanvasKitInitFn = (opts: {
  locateFile: (file: string) => string;
  wasmBinary?: Uint8Array;
}) => Promise<CanvasKit>;

/** Tuning for the load's failure bounds. Defaults suit a browser on a slow connection. */
export interface LoadCanvasKitOptions {
  /** Abort the stream if no bytes arrive for this long. Default 15000. */
  stallMs?: number;
  /** Hard ceiling on the whole load. Default 45000. */
  deadlineMs?: number;
}

const DEFAULT_STALL_MS = 15_000;
const DEFAULT_DEADLINE_MS = 45_000;

let pending: Promise<CanvasKit> | null = null;

/**
 * Load CanvasKit exactly once. Subsequent calls return the same promise.
 *
 * A rejected load is NOT cached — a transient failure (flaky network, a one-off OOM during
 * instantiate, a captive portal) would otherwise strand every later caller on the same rejection.
 *
 * @param wasmUrl  Absolute URL or filesystem path to canvaskit.wasm.
 * @param onProgress  Optional callback receiving download fraction [0,1].
 * @param options  Stall and deadline bounds.
 */
export function loadCanvasKit(
  wasmUrl: string,
  onProgress?: (fraction: number) => void,
  options: LoadCanvasKitOptions = {},
): Promise<CanvasKit> {
  if (pending !== null) {
    onProgress?.(1);
    return pending;
  }
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  pending = withDeadline(init(wasmUrl, onProgress, options), deadlineMs).catch((err: unknown) => {
    pending = null;
    throw err;
  });
  return pending;
}

// Rejecting unblocks the host even though the underlying work is not cancellable.
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CanvasKit load exceeded ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function init(
  wasmUrl: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: LoadCanvasKitOptions,
): Promise<CanvasKit> {
  const mod = (await import('canvaskit-wasm/bin/full/canvaskit.js')) as {
    default: CanvasKitInitFn;
  };
  try {
    const wasmBinary = await fetchWithProgress(wasmUrl, onProgress, options);
    onProgress?.(1);
    return await mod.default({ locateFile: () => wasmUrl, wasmBinary });
  } catch {
    onProgress?.(1);
    return mod.default({ locateFile: () => wasmUrl });
  }
}

async function fetchWithProgress(
  url: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: LoadCanvasKitOptions,
): Promise<Uint8Array> {
  if (typeof fetch === 'undefined') {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(url);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  const stallMs = options.stallMs ?? DEFAULT_STALL_MS;
  const controller = new AbortController();
  let stall: ReturnType<typeof setTimeout> | undefined;
  const armStall = (): void => {
    if (stall) clearTimeout(stall);
    stall = setTimeout(() => controller.abort(), stallMs);
  };

  try {
    armStall();
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) return new Uint8Array(await res.arrayBuffer());

    const total = Number(res.headers.get('Content-Length')) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      armStall();
      chunks.push(value);
      loaded += value.length;
      // Unknown length (missing or compressed Content-Length) → a smooth creep toward ~0.9 so the
      // bar never sits at 0 and then jumps straight to 100%.
      onProgress?.(
        total > 0 ? Math.min(1, loaded / total) : 0.9 * (1 - Math.exp(-loaded / 3_000_000)),
      );
    }

    const out = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } finally {
    if (stall) clearTimeout(stall);
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd packages/render-web && bun test tests/loader.test.ts`
Expected: PASS.

- [ ] **Step 5: Export the new option type**

Add `LoadCanvasKitOptions` to `packages/render-web/src/index.ts` alongside the existing
`loadCanvasKit` export.

- [ ] **Step 6: Run the full package gate**

Run: `cd packages/render-web && bun run lint && bun run typecheck && bun test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/render-web/src/loader.ts packages/render-web/src/index.ts packages/render-web/tests/loader.test.ts
git commit -m "fix(render-web): retry after a failed load, bound stalls"
```

---

### Task 7: `render-web` — docs, changeset, byte ceiling

**Files:**
- Modify: `packages/render-web/README.md`
- Modify: `docs/design/api-specs.md` (the render-web section)
- Modify: `.perf-baseline.json` (only if the gate reports a breach)
- Create: `.changeset/render-web-context-lifecycle.md`

- [ ] **Step 1: Update the README usage block**

`packages/render-web/README.md` documents `createPostFxSurface`. Add `isLost()` to the surface
contract and change the teardown example to show the nullable `onscreenCanvas()`:

```ts
// Draw crisp overlays AFTER composite(). Null while the context is lost.
const overlay = pfxSurface.onscreenCanvas();
if (overlay) drawHud(overlay);

// A lost context self-heals on restore; until then, fall back.
if (pfxSurface.isLost()) showStaticFallback();
```

- [ ] **Step 2: Update the API contract doc**

In `docs/design/api-specs.md`, in the `render-web` row for `PostFxSurface`, record `isLost(): boolean`
and change `onscreenCanvas()` to return `Canvas | null`.

- [ ] **Step 3: Build and measure**

Run: `bun run build && bun run check:perf-bytes`
Expected: either PASS, or a failure naming `@flare-engine/render-web` and both numbers.

- [ ] **Step 4: Reconcile the ceiling if breached**

`render-web` measured 21995 bytes against a 24195 ceiling before this work.

**If the gate passes, do nothing — skip to Step 5.**

If it fails, this is the one decision in Plan A that is **not** the implementer's to make.
`scripts/check-perf.mjs:32-33` documents that `--write` never raises a ceiling, deliberately, so a
regression cannot be admitted silently. Stop and report to the owner: the measured size, the old
ceiling, and the confirmation that the delta is the four added behaviours (explicit GPU lifecycle,
loss/restore handlers, loader deadline/stall, `Src` blend), not an accidental dependency pull.
Only on an explicit owner instruction, reset the entry in `.perf-baseline.json` to the new measured
value with a fresh `measuredAt`, and record the reason in the commit body.

Do not run `check-perf --write --bytes` hoping it absorbs the change. It will not.

- [ ] **Step 5: Write the changeset**

Create `.changeset/render-web-context-lifecycle.md`:

```markdown
---
'@flare-engine/render-web': minor
---

Take explicit ownership of the WebGL context so `dispose()` frees the `GrDirectContext` and the
context handle instead of leaking one per surface; self-heal on `webglcontextlost` /
`webglcontextrestored`; add `isLost()`; set `Src` blend on the composite blit; retry after a failed
`loadCanvasKit` instead of caching the rejection, and bound the load with stall and deadline timers.

`onscreenCanvas()` now returns `Canvas | null` — it is null while the context is lost.
```

- [ ] **Step 6: Run the repo gate**

Run: `bun run lint && bun run typecheck && bun test && bun run build && bun run check:changeset`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/render-web/README.md docs/design/api-specs.md .changeset/render-web-context-lifecycle.md
git commit -m "docs(render-web): document isLost and nullable onscreenCanvas"
```

---

### Task 8: Release hygiene

Three unrelated small gaps, batched because each is a few minutes and none warrants its own review
gate.

**Files:**
- Modify: `docs/design/api-specs.md:243`
- Create: `.github/CODEOWNERS`
- Create: `packages/create-flare-app/CHANGELOG.md`

- [ ] **Step 1: Fix the pathfinding contract drift**

`docs/design/api-specs.md:243` documents a signature the code does not have. Verified against
`packages/pathfinding/src/astar.ts:9-16,128-135` and `packages/pathfinding/src/jps.ts:78-92`.

Replace the two table rows:

```markdown
| `findPath(grid, startX, startY, endX, endY, options?)` | A\* over `Grid`. Returns `PathResult { path, cost, explored }` or `null` when no route exists. `PathOptions` selects `manhattanDistance` / `octileDistance` / `chebyshevDistance` / `euclideanDistance` heuristics + diagonal toggle. |
| `findPathJPS(grid, startX, startY, endX, endY, options?)` | Jump-Point Search variant — typically 5–10× faster than A\* on uniform open grids; falls back to A\*-equivalent moves when costs vary. Returns `PathResult | null`. `JpsOptions`. |
```

Note both corrections: the parameters were wrong (`start, goal` → four scalars) **and** the return
shape was wrong (`{ found, cells, cost }` → `{ path, cost, explored } | null`). OSS-D3 corrected the
README and left this file behind. No gate compares this doc to source, so verify by reading both
signatures directly.

- [ ] **Step 2: Add CODEOWNERS**

Create `.github/CODEOWNERS`:

```
# Default owner for everything in the repo.
* @grzott
```

- [ ] **Step 3: Add the missing changelog**

`create-flare-app` is the only one of 41 packages without a `CHANGELOG.md`, because it is
`private: true` and changeset generation skipped it. Create
`packages/create-flare-app/CHANGELOG.md`:

```markdown
# create-flare-app

## 0.2.1

Initial published changelog. Versions before this were cut in lockstep with `@flare-engine/*`
without a per-package changelog entry.
```

- [ ] **Step 4: Verify**

Run: `bun run lint && bun run check:readme`
Expected: green. `check:readme` compiles README snippets; it does not read `api-specs.md`, so the
doc fix is verified by inspection against the two source files named in Step 1.

- [ ] **Step 5: Commit**

```bash
git add docs/design/api-specs.md .github/CODEOWNERS packages/create-flare-app/CHANGELOG.md
git commit -m "docs(api-specs): correct the pathfinding signatures"
```

---

## Plan A exit criteria

- `bun run lint && bun run typecheck && bun test && bun run build` green from the repo root.
- `bun run check:changeset`, `check:exports`, `check:nodenext`, `check:readme`, `check:deps` green.
- `check:perf-bytes` green, or breached-and-owner-reconciled per Task 7 Step 4.
- Two new changesets on disk, both `minor`, verified with `changeset status`.
- `Vec2.perp` / `Vec2.crossSV` available for Plan B.
- `render-web` no longer leaks a WebGL context per surface, survives a loss/restore cycle, and
  retries a failed load.

## What Plan A does not do

- `@flare-engine/dynamics` — Plan B, reusing
  [dynamics-lift-2026-08-tasks.md](dynamics-lift-2026-08-tasks.md).
- Web benchmarks (PERF-6) — Plan C.
- The release cut and both consumer swaps — Plan D.
- Any `render-web` RAF / DPR / IntersectionObserver lifecycle helper — cut under YAGNI in spec §9.
