/**
 * Type-level assignability probe: PostFxRuntime must be structurally assignable
 * to FrameRendererPostFxRuntime (the type PT consumes via PostFxRuntimeLike in
 * @flare-engine/react).
 *
 * This file is not a bun test — it is a tsc-only check, executed by the root
 * `bun run typecheck:tests` (the only config that includes every package's
 * tests directory).
 * It must FAIL before the uniforms widening in runtime.ts / frame-renderer.ts
 * and PASS after.
 *
 * That gate runs after `build`, which matters here: the two imports below
 * resolve to each package's `dist/*.d.mts`, not its `src`. Narrowing
 * `FrameRendererCompiledPass.uniforms` in src alone leaves this file green
 * until the dist is rebuilt — verified 2026-09-04 by mutation.
 */
import type { PostFxRuntime } from '@flare-engine/postfx';
import type { FrameRendererPostFxRuntime } from '@flare-engine/render';

declare const runtime: PostFxRuntime;

// If Float32Array (postfx) and number[] (render) are not mutually assignable as
// makeShaderWithChildren uniforms, tsc reports:
//   Type 'PostFxRuntime' is not assignable to type 'FrameRendererPostFxRuntime'
const _assignable: FrameRendererPostFxRuntime = runtime;
