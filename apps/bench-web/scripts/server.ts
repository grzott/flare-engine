/**
 * Bun's fullstack dev-server: importing `index.html` and passing it to `Bun.serve` auto-bundles
 * the `<script type="module">` it references (including workspace `@flare-engine/*` imports) —
 * no bundler dependency beyond Bun itself.
 */
import indexHtml from '../index.html';

export type BenchServer = {
  readonly url: string;
  stop(): void;
};

const wasmPath = Bun.resolveSync('canvaskit-wasm/bin/full/canvaskit.wasm', import.meta.dir);

/** Start the bench-web server on an OS-assigned free port. */
export function startServer(): BenchServer {
  const server = Bun.serve({
    port: 0,
    routes: {
      '/': indexHtml,
    },
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/canvaskit.wasm') {
        return new Response(Bun.file(wasmPath), {
          headers: { 'Content-Type': 'application/wasm' },
        });
      }
      return new Response('Not found', { status: 404 });
    },
  });

  return {
    url: server.url.toString(),
    stop: () => server.stop(true),
  };
}

// Run directly (`bun run dev`) as a standalone dev server.
if (import.meta.main) {
  const { url } = startServer();
  console.log(`bench-web dev server: ${url}`);
}
