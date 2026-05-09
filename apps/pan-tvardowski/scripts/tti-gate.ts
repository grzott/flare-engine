#!/usr/bin/env bun
/**
 * Reads JSON output of `parse-boot-trace.ts` from stdin, summarizes per-device
 * stats, and exits 0 if every device's median TTI is under threshold; exits 3
 * otherwise. Used by `run-smoke-local.sh` and the cloud runner script.
 *
 * Env:
 *   DEVICE_NAME      label for the summary (default "local")
 *   TTI_THRESHOLD_MS millisecond ceiling, exclusive (default 3000)
 */
import { type TtiResult, summarizeDevice } from './parse-boot-trace';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

const text = await readStdin();
const runs = JSON.parse(text) as TtiResult[];
const device = process.env.DEVICE_NAME ?? 'local';
const threshold = Number(process.env.TTI_THRESHOLD_MS ?? '3000');
const summary = summarizeDevice(device, runs, threshold);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exit(summary.passed ? 0 : 3);
