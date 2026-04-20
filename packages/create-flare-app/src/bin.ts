#!/usr/bin/env node
import { buildProgram } from './cli.js';

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[create-flare-app] ${msg}\n`);
    process.exit(1);
  });
