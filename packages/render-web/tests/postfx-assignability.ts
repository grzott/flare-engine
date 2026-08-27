/**
 * Type-level assignability probe: PostFxRuntime must be structurally assignable
 * to FrameRendererPostFxRuntime (the type PT consumes via PostFxRuntimeLike in
 * @flare-engine/react).
 *
 * This file is not a bun test — it is a tsc-only check. Running
 *   tsc --noEmit --project packages/render-web/tsconfig.tests.json
 * must FAIL before the uniforms widening in runtime.ts / frame-renderer.ts
 * and PASS after.
 */
import type { PostFxRuntime } from '@flare-engine/postfx';
import type { FrameRendererPostFxRuntime } from '@flare-engine/render';

declare const runtime: PostFxRuntime;

// If Float32Array (postfx) and number[] (render) are not mutually assignable as
// makeShaderWithChildren uniforms, tsc reports:
//   Type 'PostFxRuntime' is not assignable to type 'FrameRendererPostFxRuntime'
const _assignable: FrameRendererPostFxRuntime = runtime;
