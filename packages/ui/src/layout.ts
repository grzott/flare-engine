/**
 * Minimal flex-like layout resolver.
 *
 * Computes positions + sizes for a single container + its direct children.
 * Supports row/column direction, gap, padding, main-axis `justifyContent`,
 * cross-axis `alignItems`, and per-child `grow` / `basis` / fixed size.
 *
 * Pure function — callers use it to drive their own renderer. React Native
 * already does its own flex, so this is primarily for Skia-rendered HUD /
 * menu layouts that need deterministic pixel positions.
 */

export type FlexDirection = 'row' | 'column';
export type JustifyContent =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
export type AlignItems = 'start' | 'end' | 'center' | 'stretch';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutChild {
  /** Fixed main-axis size. Ignored when `grow > 0`. */
  basis?: number;
  /** Fractional share of leftover main-axis space. */
  grow?: number;
  /** Fixed cross-axis size. Overrides stretch. */
  crossSize?: number;
}

export interface LayoutContainer {
  width: number;
  height: number;
  direction: FlexDirection;
  gap?: number;
  padding?: Partial<Padding>;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ZERO_PAD: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

function resolvePadding(p: Partial<Padding> | undefined): Padding {
  if (!p) return ZERO_PAD;
  return {
    top: p.top ?? 0,
    right: p.right ?? 0,
    bottom: p.bottom ?? 0,
    left: p.left ?? 0,
  };
}

export function resolveLayout(
  container: LayoutContainer,
  children: readonly LayoutChild[],
): LayoutRect[] {
  const n = children.length;
  if (n === 0) return [];

  const pad = resolvePadding(container.padding);
  const gap = container.gap ?? 0;
  const isRow = container.direction === 'row';
  const mainSize =
    (isRow ? container.width : container.height) -
    (isRow ? pad.left + pad.right : pad.top + pad.bottom);
  const crossSize =
    (isRow ? container.height : container.width) -
    (isRow ? pad.top + pad.bottom : pad.left + pad.right);
  const mainStart = isRow ? pad.left : pad.top;
  const crossStart = isRow ? pad.top : pad.left;
  const justify = container.justifyContent ?? 'start';
  const align = container.alignItems ?? 'stretch';
  const totalGap = gap * Math.max(0, n - 1);

  let totalBasis = 0;
  let totalGrow = 0;
  for (const c of children) {
    totalBasis += c.basis ?? 0;
    totalGrow += c.grow ?? 0;
  }

  const leftover = mainSize - totalBasis - totalGap;
  const sizes: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = children[i] as LayoutChild;
    const base = c.basis ?? 0;
    const growShare = totalGrow > 0 ? ((c.grow ?? 0) / totalGrow) * Math.max(0, leftover) : 0;
    sizes[i] = Math.max(0, base + growShare);
  }

  const used = sizes.reduce((acc, s) => acc + s, 0) + totalGap;
  const free = Math.max(0, mainSize - used);

  let cursor = mainStart;
  let spacing = gap;
  switch (justify) {
    case 'start':
      break;
    case 'end':
      cursor = mainStart + free;
      break;
    case 'center':
      cursor = mainStart + free / 2;
      break;
    case 'space-between':
      if (n > 1) spacing = gap + free / (n - 1);
      break;
    case 'space-around':
      if (n > 0) {
        const s = free / n;
        cursor = mainStart + s / 2;
        spacing = gap + s;
      }
      break;
    case 'space-evenly':
      if (n >= 0) {
        const s = free / (n + 1);
        cursor = mainStart + s;
        spacing = gap + s;
      }
      break;
  }

  const out: LayoutRect[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = children[i] as LayoutChild;
    const mainLen = sizes[i] as number;
    const crossLen = c.crossSize !== undefined ? c.crossSize : align === 'stretch' ? crossSize : 0;

    let crossOffset: number;
    switch (align) {
      case 'start':
        crossOffset = 0;
        break;
      case 'end':
        crossOffset = crossSize - crossLen;
        break;
      case 'center':
        crossOffset = (crossSize - crossLen) / 2;
        break;
      case 'stretch':
        crossOffset = 0;
        break;
    }

    const x = isRow ? cursor : crossStart + crossOffset;
    const y = isRow ? crossStart + crossOffset : cursor;
    const w = isRow ? mainLen : crossLen;
    const h = isRow ? crossLen : mainLen;

    out[i] = { x, y, width: w, height: h };
    cursor += mainLen + spacing;
  }

  return out;
}
