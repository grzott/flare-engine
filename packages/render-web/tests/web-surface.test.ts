import { describe, expect, it } from 'bun:test';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSurface } from '../src/web-surface.js';

interface MockCanvas {
  save(): number;
  restore(): void;
  translate(x: number, y: number): void;
  scale(sx: number, sy: number): void;
  rotate(deg: number, cx: number, cy: number): void;
  clear(color: Float32Array): void;
}

function makeCanvas(calls: string[]): MockCanvas {
  return {
    save() {
      calls.push('save');
      return 0;
    },
    restore() {
      calls.push('restore');
    },
    translate(x, y) {
      calls.push(`translate(${x},${y})`);
    },
    scale(sx, sy) {
      calls.push(`scale(${sx},${sy})`);
    },
    rotate(deg, cx, cy) {
      calls.push(`rotate(${deg},${cx},${cy})`);
    },
    clear(color) {
      calls.push(`clear(${Array.from(color).join(',')})`);
    },
  };
}

/** A kit whose one WebGL surface records `flush`/`delete` in the same call log as its canvas. */
function makeMockKit(calls: string[]): { kit: CanvasKit; canvas: MockCanvas } {
  const canvas = makeCanvas(calls);
  const kit = {
    MakeWebGLCanvasSurface: (_canvas: unknown) => ({
      getCanvas: () => canvas,
      flush: () => {
        calls.push('flush');
      },
      delete: () => {
        calls.push('delete');
      },
    }),
  } as unknown as CanvasKit;
  return { kit, canvas };
}

describe('createWebSurface', () => {
  it('returns null when MakeWebGLCanvasSurface returns null', () => {
    const kit = { MakeWebGLCanvasSurface: () => null } as unknown as CanvasKit;
    const result = createWebSurface(kit, {} as HTMLCanvasElement);
    expect(result).toBeNull();
  });

  it('forwards save/restore/translate/scale to the CK canvas', () => {
    const calls: string[] = [];
    const { kit } = makeMockKit(calls);
    const surface = createWebSurface(kit, {} as HTMLCanvasElement);
    expect(surface).not.toBeNull();
    surface!.canvas.save();
    surface!.canvas.restore();
    surface!.canvas.translate(10, 20);
    surface!.canvas.scale(2, 3);
    expect(calls).toEqual(['save', 'restore', 'translate(10,20)', 'scale(2,3)']);
  });

  it('forwards rotate value verbatim (pass-through, no radians→degrees conversion)', () => {
    const calls: string[] = [];
    const { kit } = makeMockKit(calls);
    const surface = createWebSurface(kit, {} as HTMLCanvasElement);
    surface!.canvas.rotate(Math.PI / 2, 5, 10);
    expect(calls).toHaveLength(1);
    const match = calls[0]!.match(/rotate\(([^,]+),5,10\)/);
    expect(match).not.toBeNull();
    const forwarded = Number.parseFloat(match![1]!);
    expect(Math.abs(forwarded - Math.PI / 2)).toBeLessThan(0.000001);
  });

  it('unpacks packed ARGB integer and forwards Float32Array to CK clear', () => {
    const calls: string[] = [];
    const { kit } = makeMockKit(calls);
    const surface = createWebSurface(kit, {} as HTMLCanvasElement);
    // 0xFF0000FF = opaque blue (A=255, R=0, G=0, B=255)
    surface!.canvas.clear(0xff0000ff);
    expect(calls).toHaveLength(1);
    // Expect [r=0, g=0, b=1, a=1]
    expect(calls[0]).toBe('clear(0,0,1,1)');
  });

  it('exposes the CK canvas the CanvasLike wraps, so a frame picture can be presented', () => {
    const calls: string[] = [];
    const { kit, canvas } = makeMockKit(calls);
    const surface = createWebSurface(kit, {} as HTMLCanvasElement);
    expect(surface!.ckCanvas as unknown).toBe(canvas);
  });

  it('flush() presents the surface — draws are invisible until it runs', () => {
    const calls: string[] = [];
    const { kit } = makeMockKit(calls);
    const surface = createWebSurface(kit, {} as HTMLCanvasElement)!;
    surface.canvas.clear(0xff000000);
    expect(calls).not.toContain('flush');
    surface.flush();
    expect(calls[calls.length - 1]).toBe('flush');
  });

  it('dispose() deletes the CK surface exactly once and makes flush() a no-op', () => {
    const calls: string[] = [];
    const { kit } = makeMockKit(calls);
    const surface = createWebSurface(kit, {} as HTMLCanvasElement)!;
    surface.dispose();
    surface.dispose();
    expect(calls.filter((c) => c === 'delete')).toHaveLength(1);
    surface.flush();
    expect(calls).not.toContain('flush');
  });
});
