import { describe, expect, it } from 'bun:test';
import { Renderer } from '../src/renderer.js';
import type { CanvasLike } from '../src/renderer.js';

function mockCanvas(): CanvasLike & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    save() {
      calls.push('save');
      return 0;
    },
    restore() {
      calls.push('restore');
    },
    translate(x: number, y: number) {
      calls.push(`translate(${x},${y})`);
    },
    scale(sx: number, sy: number) {
      calls.push(`scale(${sx},${sy})`);
    },
    rotate(rad: number, cx: number, cy: number) {
      calls.push(`rotate(${rad},${cx},${cy})`);
    },
    clear(color: number) {
      calls.push(`clear(${color})`);
    },
  };
}

describe('Renderer', () => {
  it('begin/end lifecycle', () => {
    const r = new Renderer();
    const c = mockCanvas();
    r.setCanvas(c);

    r.begin();
    expect(r.inFrame).toBe(true);
    expect(c.calls).toContain('save');
    expect(c.calls).toContain('clear(4278190080)'); // 0xFF000000

    r.end();
    expect(r.inFrame).toBe(false);
    expect(c.calls).toContain('restore');
  });

  it('begin with custom clear color', () => {
    const r = new Renderer();
    const c = mockCanvas();
    r.setCanvas(c);
    r.begin(0xff0000ff);
    expect(c.calls).toContain('clear(4278190335)');
    r.end();
  });

  it('throws if begin called twice', () => {
    const r = new Renderer();
    r.setCanvas(mockCanvas());
    r.begin();
    expect(() => r.begin()).toThrow('already in frame');
    r.end();
  });

  it('throws if end called without begin', () => {
    const r = new Renderer();
    r.setCanvas(mockCanvas());
    expect(() => r.end()).toThrow('without begin');
  });

  it('throws if canvas not set', () => {
    const r = new Renderer();
    expect(() => r.canvas).toThrow('no canvas set');
  });

  it('resets stats on begin', () => {
    const r = new Renderer();
    r.setCanvas(mockCanvas());

    r.begin();
    r.recordDrawCall();
    r.recordDrawCall();
    r.recordBatch();
    expect(r.stats.drawCalls).toBe(2);
    expect(r.stats.batchCount).toBe(1);
    r.end();

    r.begin();
    expect(r.stats.drawCalls).toBe(0);
    expect(r.stats.batchCount).toBe(0);
    r.end();
  });

  it('applyCamera transforms canvas correctly', () => {
    const r = new Renderer();
    const c = mockCanvas();
    r.setCanvas(c);
    r.begin();
    c.calls.length = 0; // Clear setup calls

    r.applyCamera(100, 50, 2, 0, 800, 600);
    expect(c.calls).toEqual([
      'translate(400,300)', // center
      'scale(2,2)', // zoom
      'translate(-100,-50)', // camera offset
    ]);
    r.end();
  });

  it('applyCamera includes rotation', () => {
    const r = new Renderer();
    const c = mockCanvas();
    r.setCanvas(c);
    r.begin();
    c.calls.length = 0;

    const rot = Math.PI / 4;
    r.applyCamera(0, 0, 1, rot, 800, 600);
    expect(c.calls).toHaveLength(4); // translate, scale, rotate, translate
    expect(c.calls[2]).toContain('rotate');
    r.end();
  });
});
