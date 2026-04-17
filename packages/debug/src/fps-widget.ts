import type { DebugStats } from './stats.js';

/**
 * Formatter for a compact FPS / stats overlay.
 *
 * Consumes a `DebugStats` snapshot and exposes formatted strings ready
 * for the host to draw (Skia `canvas.drawText`, an RN `<Text>` overlay,
 * whatever). The widget itself has no rendering dependency so it stays
 * drop-in across renderers.
 *
 * Wrap in `__DEV__` at the call site for tree-shaking.
 */
export interface FpsWidget {
  /** Rebuild `line` / `lines` from the latest stats. */
  update(stats: DebugStats): void;
  /** Compact one-line summary, e.g. "60 FPS | 16.7ms | e:42 d:8". */
  line: string;
  /** Multi-line breakdown — one string per stat row. */
  readonly lines: string[];
}

/** Options for the FPS widget formatter. */
export interface FpsWidgetOptions {
  /** Show entity count in the one-line summary. Default true. */
  showEntities?: boolean;
  /** Show draw call count in the one-line summary. Default true. */
  showDrawCalls?: boolean;
  /** Number of decimals for milliseconds. Default 1. */
  msPrecision?: number;
}

/** Create a new FPS widget formatter. */
export function createFpsWidget(options: FpsWidgetOptions = {}): FpsWidget {
  const showEntities = options.showEntities ?? true;
  const showDrawCalls = options.showDrawCalls ?? true;
  const msPrecision = options.msPrecision ?? 1;
  const lines: string[] = [];

  const widget: FpsWidget = {
    line: '',
    lines,
    update(stats: DebugStats): void {
      const fps = Math.round(stats.fps);
      const ms = (stats.rawDt * 1000).toFixed(msPrecision);

      let summary = `${fps} FPS | ${ms}ms`;
      if (showEntities) summary += ` | e:${stats.entityCount}`;
      if (showDrawCalls) summary += ` d:${stats.drawCalls}`;
      widget.line = summary;

      lines.length = 0;
      lines.push(`FPS: ${fps}`);
      lines.push(`dt: ${ms}ms`);
      lines.push(`frame: ${stats.frame}`);
      lines.push(`entities: ${stats.entityCount}`);
      lines.push(`draws: ${stats.drawCalls}`);
    },
  };
  return widget;
}
