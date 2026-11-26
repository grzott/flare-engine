import type { CanvasKit, Image as CKImage } from 'canvaskit-wasm';
import type { FractureMesh, ShardPacking } from '../../core/fracture/types';
import type { FxImage } from '../../runtime/contracts';

/**
 * Draw every piece of `mesh` into its packed rect of a new shard atlas, clipped by the piece's
 * polygon, and return the atlas as an image of `packing.atlasW` by `packing.atlasH` pixels. The
 * caller owns it, and deletes it.
 *
 * `capture` is `image` uploaded to `kit`. `packing` is `packShardsInto` for `widthPx` by
 * `heightPx`, the element's size in image pixels, so a piece's bounding box starts at the corner
 * of its rect, `packing.scale` atlas pixels per image pixel.
 *
 * Throws when CanvasKit can make no surface of that size.
 */
export function bakeShardAtlas(
  kit: CanvasKit,
  capture: CKImage,
  image: FxImage,
  mesh: FractureMesh,
  packing: ShardPacking,
  widthPx: number,
  heightPx: number,
): CKImage {
  // A raster surface: its snapshot is a CPU image, which the WebGL canvas uploads when it draws.
  const surface = kit.MakeSurface(packing.atlasW, packing.atlasH);
  if (surface === null) {
    throw new Error(`no ${packing.atlasW} x ${packing.atlasH} surface for the shard atlas`);
  }
  const { count, vertexStart, vertices, bounds } = mesh;
  const { rects, scale } = packing;
  // Atlas pixels per unit of the mesh, whose coordinates are 0..1 of the element.
  const unitX = widthPx * scale;
  const unitY = heightPx * scale;
  const inset = image.padding * image.pixelRatio * scale;
  const canvas = surface.getCanvas();

  for (let i = 0; i < count; i++) {
    // Where the element's top left corner is when the piece's bounding box is on its rect.
    const left = rects[i * 4]! - bounds[i * 4]! * unitX;
    const top = rects[i * 4 + 1]! - bounds[i * 4 + 1]! * unitY;
    const cmds: number[] = [];
    for (let v = vertexStart[i]!; v < vertexStart[i + 1]!; v++) {
      cmds.push(
        cmds.length === 0 ? kit.MOVE_VERB : kit.LINE_VERB,
        left + vertices[v * 2]! * unitX,
        top + vertices[v * 2 + 1]! * unitY,
      );
    }
    cmds.push(kit.CLOSE_VERB);
    const path = kit.Path.MakeFromCmds(cmds);
    if (path === null) continue;
    canvas.save();
    canvas.clipPath(path, kit.ClipOp.Intersect, true);
    canvas.translate(left - inset, top - inset);
    canvas.scale(scale, scale);
    // A piece rarely starts on a whole pixel of the capture.
    canvas.drawImageOptions(capture, 0, 0, kit.FilterMode.Linear, kit.MipmapMode.None);
    canvas.restore();
    path.delete();
  }

  surface.flush();
  const atlas = surface.makeImageSnapshot();
  surface.delete();
  return atlas;
}
