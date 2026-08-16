import { loadCanvasKit } from '@flare-engine/render-web';
import { RENDER_SCENARIO_NAMES, runRenderSuite, type ScenarioResult } from './runner.js';

declare global {
  interface Window {
    /** Set once the run finishes (successfully or not) — Playwright polls this. */
    __BENCH_DONE__?: boolean;
    /** Present on success: one record per `RENDER_SCENARIO_NAMES` entry. */
    __BENCH_RESULTS__?: readonly ScenarioResult[];
    /** Grows one entry at a time as each scenario finishes — lets a driver observe real
     *  percentile numbers well before the full (multi-minute) suite completes. */
    __BENCH_PARTIAL__?: readonly ScenarioResult[];
    /** Present on failure. */
    __BENCH_ERROR__?: string;
  }
}

const statusEl = document.getElementById('status') as HTMLDivElement;
const tableEl = document.getElementById('results-table') as HTMLTableElement;
const tbodyEl = tableEl.querySelector('tbody') as HTMLTableSectionElement;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function renderRow(result: ScenarioResult): void {
  const tr = document.createElement('tr');
  const cells = [
    result.name,
    String(result.samples),
    result.p50Ms.toFixed(3),
    result.p95Ms.toFixed(3),
    result.p99Ms.toFixed(3),
  ];
  for (const text of cells) {
    const td = document.createElement('td');
    td.textContent = text;
    tr.appendChild(td);
  }
  tbodyEl.appendChild(tr);
}

async function main(): Promise<void> {
  setStatus(`loading CanvasKit…`);
  const kit = await loadCanvasKit('/canvaskit.wasm', (fraction) => {
    setStatus(`loading CanvasKit… ${Math.round(fraction * 100)}%`);
  });

  tableEl.hidden = false;
  setStatus(`running ${RENDER_SCENARIO_NAMES.length} render scenarios…`);
  window.__BENCH_PARTIAL__ = [];

  const results = await runRenderSuite(kit, (done, total, result) => {
    renderRow(result);
    window.__BENCH_PARTIAL__ = [...(window.__BENCH_PARTIAL__ ?? []), result];
    setStatus(`running render scenarios… ${done}/${total}`);
    // One line per scenario, forwarded to the driver's stderr via the `console` listener in
    // browser-driver.mjs — lets an external run distinguish "still working" from "hung" without
    // waiting for the full multi-minute suite to finish.
    console.log(`[bench] ${done}/${total} ${result.name} p50=${result.p50Ms.toFixed(3)}ms`);
  });

  window.__BENCH_RESULTS__ = results;
  window.__BENCH_DONE__ = true;
  setStatus(`done — ${results.length} scenarios`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  window.__BENCH_ERROR__ = message;
  window.__BENCH_DONE__ = true;
  setStatus(`FAILED: ${message}`);
});
