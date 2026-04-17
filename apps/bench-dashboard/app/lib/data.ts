import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DeviceReport, MicrobenchReport } from './types';

function readJson<T>(relPath: string): T {
  const abs = resolve(process.cwd(), relPath);
  return JSON.parse(readFileSync(abs, 'utf8')) as T;
}

const MICRO_PATH = '../../benchmarks/results/microbench.json';
const DEVICE_PATH = '../../benchmarks/results/device.json';

export function getMicrobenchReport(): MicrobenchReport {
  return readJson<MicrobenchReport>(MICRO_PATH);
}

export function getDeviceReport(): DeviceReport {
  return readJson<DeviceReport>(DEVICE_PATH);
}
