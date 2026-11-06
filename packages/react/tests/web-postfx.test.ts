import { describe, expect, it } from 'bun:test';
import type { FrameRendererCompiledPass } from '@flare-engine/render';
import {
  createWebPostFxCompositor,
  type WebPostFxImageLike,
  type WebPostFxModuleLike,
  type WebPostFxSurfaceLike,
} from '../src/web-postfx.js';

/**
 * #60: the web postfx chain runs imperatively, in place, over the scene
 * capture's offscreen surface. These exercise the compositor against a
 * counting stub that logs every call in order — the order and the disposal
 * balance ARE the behaviour under test (the surface is reused across passes
 * and frames, so a pass that samples the wrong snapshot or leaks one shader
 * per frame is a correctness bug, not a perf nit).
 */

/** `Symbol.dispose` is outside this project's ES2022 lib, so it is reached
 *  through a typed lookup rather than a computed key literal. */
const DISPOSE = (Symbol as unknown as { dispose?: symbol }).dispose;

interface Tagged {
  tag: string;
  from?: unknown;
}

interface Stub {
  Skia: WebPostFxModuleLike;
  surface: WebPostFxSurfaceLike<Tagged & WebPostFxImageLike>;
  log: string[];
  created: Tagged[];
  disposed: Tagged[];
  paintCount: number;
  paintDisposed: number;
  snapshots: Tagged[];
  childImage(name: string): WebPostFxImageLike & { disposed: boolean };
  pass(
    id: string,
    uniforms: Float32Array,
    children?: readonly unknown[],
    returnNull?: boolean,
  ): { pass: FrameRendererCompiledPass; calls: Array<{ uniforms: unknown; children: unknown[] }> };
}

function makeStub(): Stub {
  const log: string[] = [];
  const created: Tagged[] = [];
  const disposed: Tagged[] = [];
  const snapshots: Tagged[] = [];
  let snapshotCount = 0;

  const disposable = <T extends Tagged>(obj: T): T => {
    created.push(obj);
    if (DISPOSE !== undefined) {
      (obj as unknown as Record<symbol, unknown>)[DISPOSE] = (): void => {
        disposed.push(obj);
        log.push(`dispose:${obj.tag}`);
      };
    }
    return obj;
  };

  const makeShaderOptions = (owner: Tagged) => {
    return (tx: number, ty: number, fm: number, mm: number): unknown => {
      log.push(`makeShaderOptions:${owner.tag}:${tx},${ty},${fm},${mm}`);
      return disposable({ tag: `shader(${owner.tag})`, from: owner });
    };
  };

  const stub: Stub = {
    log,
    created,
    disposed,
    snapshots,
    paintCount: 0,
    paintDisposed: 0,
    Skia: {
      Paint() {
        stub.paintCount++;
        const paint = {
          tag: 'paint',
          setShader(shader: unknown) {
            const t = shader === null ? 'null' : (shader as Tagged).tag;
            log.push(`setShader:${t}`);
          },
          setBlendMode(mode: number) {
            log.push(`setBlendMode:${mode}`);
          },
        };
        if (DISPOSE !== undefined) {
          (paint as unknown as Record<symbol, unknown>)[DISPOSE] = (): void => {
            stub.paintDisposed++;
          };
        }
        return paint;
      },
    },
    surface: {
      getCanvas: () => ({
        drawRect(rect, paint) {
          const p = paint as Tagged;
          log.push(`drawRect:${rect.x},${rect.y},${rect.width},${rect.height}:${p.tag}`);
        },
      }),
      makeImageSnapshot() {
        snapshotCount++;
        const snap: Tagged & WebPostFxImageLike = {
          tag: `snapshot#${snapshotCount}`,
          makeShaderOptions: () => null,
        };
        snap.makeShaderOptions = makeShaderOptions(snap);
        log.push(`snapshot:${snap.tag}`);
        snapshots.push(snap);
        return disposable(snap);
      },
      flush() {
        log.push('flush');
      },
    },
    childImage(name) {
      const img: Tagged & WebPostFxImageLike & { disposed: boolean } = {
        tag: `image(${name})`,
        disposed: false,
        makeShaderOptions: () => null,
      };
      img.makeShaderOptions = makeShaderOptions(img);
      if (DISPOSE !== undefined) {
        (img as unknown as Record<symbol, unknown>)[DISPOSE] = (): void => {
          img.disposed = true;
        };
      }
      return img;
    },
    pass(id, uniforms, children = [], returnNull = false) {
      const calls: Array<{ uniforms: unknown; children: unknown[] }> = [];
      const pass: FrameRendererCompiledPass = {
        id,
        shader: {
          makeShaderWithChildren(u, c) {
            calls.push({ uniforms: u, children: c.slice() });
            log.push(`makeShaderWithChildren:${id}:[${c.map((x) => (x as Tagged).tag).join(',')}]`);
            return returnNull ? null : disposable({ tag: `pass(${id})` });
          },
        },
        uniforms,
        children,
      };
      return { pass, calls };
    },
  };
  return stub;
}

describe('createWebPostFxCompositor', () => {
  it('construction creates one paint set to BlendMode.Src (1); empty passes call nothing', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    expect(stub.paintCount).toBe(1);
    expect(stub.log).toEqual(['setBlendMode:1']);
    stub.log.length = 0;

    fx.composite(stub.surface, [], 800, 600);

    expect(stub.log).toEqual([]);
    expect(stub.created).toHaveLength(0);
  });

  it('one pass: snapshot → src shader (clamp, clamp, linear, none) → build → draw → flush → release', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    stub.log.length = 0;
    const uniforms = new Float32Array([0.5, 800, 600]);
    const { pass, calls } = stub.pass('flash', uniforms);

    fx.composite(stub.surface, [pass], 800, 600);

    expect(stub.log).toEqual([
      'snapshot:snapshot#1',
      'makeShaderOptions:snapshot#1:0,0,1,0',
      'makeShaderWithChildren:flash:[shader(snapshot#1)]',
      'setShader:pass(flash)',
      'drawRect:0,0,800,600:paint',
      'setShader:null',
      'flush',
      'dispose:pass(flash)',
      'dispose:shader(snapshot#1)',
      'dispose:snapshot#1',
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.uniforms).toBe(uniforms);
    expect(calls[0]?.children).toHaveLength(1);
    expect((calls[0]!.children[0] as Tagged).from).toBe(stub.snapshots[0]);
  });

  it('two passes: the second samples a snapshot taken after the first pass drew', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    stub.log.length = 0;
    const a = stub.pass('a', new Float32Array([1]));
    const b = stub.pass('b', new Float32Array([2]));

    fx.composite(stub.surface, [a.pass, b.pass], 320, 240);

    const firstDraw = stub.log.indexOf('drawRect:0,0,320,240:paint');
    const secondSnapshot = stub.log.indexOf('snapshot:snapshot#2');
    expect(firstDraw).toBeGreaterThanOrEqual(0);
    expect(secondSnapshot).toBeGreaterThan(firstDraw);
    expect((b.calls[0]!.children[0] as Tagged).from).toBe(stub.snapshots[1]);
    expect((a.calls[0]!.children[0] as Tagged).from).toBe(stub.snapshots[0]);
    expect(stub.snapshots).toHaveLength(2);
  });

  it('a pass with one child image binds [src, childShader], the child wrapped with (0,0,1,0)', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    stub.log.length = 0;
    const lut = stub.childImage('lut');
    const { pass, calls } = stub.pass('grade', new Float32Array([0.5]), [lut]);

    fx.composite(stub.surface, [pass], 800, 600);

    expect(calls[0]?.children).toHaveLength(2);
    expect((calls[0]!.children[0] as Tagged).from).toBe(stub.snapshots[0]);
    expect((calls[0]!.children[1] as Tagged).from).toBe(lut);
    expect(stub.log).toContain('makeShaderOptions:image(lut):0,0,1,0');
    expect(stub.log).toContain(
      'makeShaderWithChildren:grade:[shader(snapshot#1),shader(image(lut))]',
    );
  });

  it('releases every shader and snapshot it created, never the child images', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    const lut = stub.childImage('lut');
    const a = stub.pass('a', new Float32Array([1]));
    const b = stub.pass('b', new Float32Array([2]), [lut]);

    fx.composite(stub.surface, [a.pass, b.pass], 800, 600);

    expect(stub.created.length).toBeGreaterThan(0);
    expect(stub.disposed.length).toBe(stub.created.length);
    expect(lut.disposed).toBe(false);
  });

  it('across 100 frames created === disposed and no child image is released', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    const lut = stub.childImage('lut');
    const a = stub.pass('a', new Float32Array([1]));
    const b = stub.pass('b', new Float32Array([2]), [lut]);
    const passes = [a.pass, b.pass];

    for (let frame = 0; frame < 100; frame++) {
      fx.composite(stub.surface, passes, 800, 600);
    }

    // 2 passes × (snapshot + src shader + pass shader) + 1 lut shader, per frame.
    expect(stub.created).toHaveLength(100 * 7);
    expect(stub.disposed).toHaveLength(100 * 7);
    expect(lut.disposed).toBe(false);
  });

  it('a null pass shader skips the draw but still releases the src shader and snapshot', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    stub.log.length = 0;
    const { pass } = stub.pass('broken', new Float32Array([1]), [], true);

    fx.composite(stub.surface, [pass], 800, 600);

    expect(stub.log.some((l) => l.startsWith('drawRect'))).toBe(false);
    expect(stub.log.some((l) => l.startsWith('setShader'))).toBe(false);
    expect(stub.log).toContain('flush');
    expect(stub.disposed.length).toBe(stub.created.length);
    expect(stub.created).toHaveLength(2);
  });

  it('Paint() is created once and setBlendMode(1) called once across many frames', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);
    const { pass } = stub.pass('a', new Float32Array([1]));

    for (let frame = 0; frame < 50; frame++) {
      fx.composite(stub.surface, [pass], 800, 600);
    }

    expect(stub.paintCount).toBe(1);
    expect(stub.log.filter((l) => l.startsWith('setBlendMode'))).toEqual(['setBlendMode:1']);
  });

  it('dispose() releases the paint', () => {
    const stub = makeStub();
    const fx = createWebPostFxCompositor(stub.Skia);

    fx.dispose();

    expect(stub.paintDisposed).toBe(1);
  });
});
