import { describe, expect, it } from 'bun:test';
import { ScreenManager } from '../src/screen.js';

describe('ScreenManager FIT mode', () => {
  it('letterboxes horizontally when screen is wider', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fit',
    });
    sm.resize(1600, 600);
    // Scale limited by height: 600/600 = 1
    expect(sm.scaleX).toBe(1);
    expect(sm.scaleY).toBe(1);
    expect(sm.offsetX).toBe(400); // (1600 - 800*1) / 2
    expect(sm.offsetY).toBe(0);
  });

  it('letterboxes vertically when screen is taller', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fit',
    });
    sm.resize(800, 1200);
    // Scale limited by width: 800/800 = 1
    expect(sm.scaleX).toBe(1);
    expect(sm.scaleY).toBe(1);
    expect(sm.offsetX).toBe(0);
    expect(sm.offsetY).toBe(300); // (1200 - 600*1) / 2
  });

  it('scales up proportionally', () => {
    const sm = new ScreenManager({
      designWidth: 400,
      designHeight: 300,
      scaleMode: 'fit',
    });
    sm.resize(800, 600);
    expect(sm.scaleX).toBe(2);
    expect(sm.scaleY).toBe(2);
    expect(sm.offsetX).toBe(0);
    expect(sm.offsetY).toBe(0);
  });
});

describe('ScreenManager FILL mode', () => {
  it('crops when screen aspect differs', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fill',
    });
    sm.resize(1600, 600);
    // Scale by max ratio: 1600/800 = 2
    expect(sm.scaleX).toBe(2);
    expect(sm.scaleY).toBe(2);
    expect(sm.offsetX).toBe(0);
    expect(sm.offsetY).toBe(-300); // (600 - 600*2) / 2
  });
});

describe('ScreenManager STRETCH mode', () => {
  it('distorts to fill', () => {
    const sm = new ScreenManager({
      designWidth: 400,
      designHeight: 300,
      scaleMode: 'stretch',
    });
    sm.resize(800, 900);
    expect(sm.scaleX).toBe(2); // 800/400
    expect(sm.scaleY).toBe(3); // 900/300
    expect(sm.offsetX).toBe(0);
    expect(sm.offsetY).toBe(0);
  });
});

describe('ScreenManager.designToScreen', () => {
  it('converts design point to screen', () => {
    const sm = new ScreenManager({
      designWidth: 400,
      designHeight: 300,
      scaleMode: 'fit',
    });
    sm.resize(800, 600);
    const screen = sm.designToScreen({ x: 100, y: 50 });
    expect(screen.x).toBe(200);
    expect(screen.y).toBe(100);
  });

  it('accounts for offset', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fit',
    });
    sm.resize(1600, 600);
    const screen = sm.designToScreen({ x: 0, y: 0 });
    expect(screen.x).toBe(400); // offset
    expect(screen.y).toBe(0);
  });
});

describe('ScreenManager.screenToDesign', () => {
  it('converts screen point to design', () => {
    const sm = new ScreenManager({
      designWidth: 400,
      designHeight: 300,
      scaleMode: 'fit',
    });
    sm.resize(800, 600);
    const design = sm.screenToDesign({ x: 200, y: 100 });
    expect(design.x).toBe(100);
    expect(design.y).toBe(50);
  });

  it('round-trips', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fit',
    });
    sm.resize(1600, 600);
    const original = { x: 123, y: 456 };
    const result = sm.screenToDesign(sm.designToScreen(original));
    expect(result.x).toBeCloseTo(123);
    expect(result.y).toBeCloseTo(456);
  });
});

describe('ScreenManager.viewport', () => {
  it('returns full design rect in fit mode', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fit',
    });
    sm.resize(1600, 600);
    const vp = sm.viewport;
    expect(vp.x).toBe(0);
    expect(vp.y).toBe(0);
    expect(vp.width).toBe(800);
    expect(vp.height).toBe(600);
  });

  it('returns cropped rect in fill mode', () => {
    const sm = new ScreenManager({
      designWidth: 800,
      designHeight: 600,
      scaleMode: 'fill',
    });
    sm.resize(1600, 600);
    const vp = sm.viewport;
    // Scale = 2, visible width = 1600/2 = 800, visible height = 600/2 = 300
    expect(vp.width).toBe(800);
    expect(vp.height).toBe(300);
  });
});

describe('ScreenManager.safeArea', () => {
  it('defaults to an empty rect before insets are set', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    sm.resize(800, 600);
    expect(sm.safeArea.x).toBe(0);
    expect(sm.safeArea.y).toBe(0);
    expect(sm.safeArea.width).toBe(800);
    expect(sm.safeArea.height).toBe(600);
  });

  it('populates from insets relative to screen size', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    sm.resize(800, 600);
    sm.setSafeAreaInsets(44, 0, 34, 0);
    expect(sm.safeArea.x).toBe(0);
    expect(sm.safeArea.y).toBe(44);
    expect(sm.safeArea.width).toBe(800);
    expect(sm.safeArea.height).toBe(522); // 600 - 44 - 34
  });

  it('recomputes on resize with insets already set', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    sm.setSafeAreaInsets(10, 20, 30, 40);
    sm.resize(1000, 800);
    expect(sm.safeArea.x).toBe(40);
    expect(sm.safeArea.y).toBe(10);
    expect(sm.safeArea.width).toBe(940); // 1000 - 40 - 20
    expect(sm.safeArea.height).toBe(760); // 800 - 10 - 30
  });

  it('clamps to 0 when insets exceed screen size', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    sm.resize(100, 100);
    sm.setSafeAreaInsets(80, 40, 80, 40);
    expect(sm.safeArea.width).toBe(20);
    expect(sm.safeArea.height).toBe(0);
  });

  it('fires onResize when insets change', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    sm.resize(800, 600);
    let fires = 0;
    sm.onResize.add(() => {
      fires++;
    });
    sm.setSafeAreaInsets(44, 0, 34, 0);
    expect(fires).toBe(1);
  });
});

describe('ScreenManager.resize', () => {
  it('fires onResize signal', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    let fired = false;
    sm.onResize.add(() => {
      fired = true;
    });
    sm.resize(800, 600);
    expect(fired).toBe(true);
  });

  it('updates pixelRatio', () => {
    const sm = new ScreenManager({ designWidth: 800, designHeight: 600 });
    sm.resize(800, 600, 3);
    expect(sm.pixelRatio).toBe(3);
  });

  it('defaults to fit mode', () => {
    const sm = new ScreenManager({ designWidth: 400, designHeight: 300 });
    sm.resize(800, 600);
    expect(sm.scaleX).toBe(2);
    expect(sm.scaleY).toBe(2);
  });
});
