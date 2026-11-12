import type { SkiaRuntimeEffectLike } from '@flare-engine/postfx';
import type { RuntimeEffectLike } from '@flare-engine/render';
import type { RuntimeEffect, Shader } from 'canvaskit-wasm';

/**
 * Wrap a CanvasKit `RuntimeEffect` for both consumers in this package: the frame renderer module
 * (`makeShader` plus uniform reflection) and the postfx surface (`makeShaderWithChildren`).
 * Internal: not exported from the package index.
 */
export function wrapRuntimeEffect(eff: RuntimeEffect): RuntimeEffectLike & SkiaRuntimeEffectLike {
  return {
    makeShader: (uniforms) => eff.makeShader(uniforms) as Shader,
    makeShaderWithChildren: (uniforms, children) =>
      eff.makeShaderWithChildren(uniforms as Float32Array, (children ?? []) as Shader[]),
    getUniformCount: () => eff.getUniformCount(),
    getUniformFloatCount: () => eff.getUniformFloatCount(),
    getUniformName: (i) => eff.getUniformName(i),
    getUniform: (i) => {
      const u = eff.getUniform(i);
      return { columns: u.columns, rows: u.rows, slot: u.slot };
    },
  };
}
