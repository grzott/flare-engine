import type { FractureMesh } from '../../src/core/fracture/types';
import { type FragmentSpec, shatter } from '../../src/core/presets';

/** A validated fragment block: the shatter defaults with `over` on top. */
export const fragmentSpec = (over: Partial<FragmentSpec> = {}): FragmentSpec =>
  shatter({ fragment: over }).fragment;

export const sumAreas = (mesh: FractureMesh): number => {
  let sum = 0;
  for (let i = 0; i < mesh.count; i++) sum += mesh.areas[i]!;
  return sum;
};

/** Shoelace area of piece `i`, from its stored vertices. */
export const polygonArea = (mesh: FractureMesh, i: number): number => {
  const start = mesh.vertexStart[i]!;
  const n = mesh.vertexStart[i + 1]! - start;
  let twice = 0;
  for (let k = 0; k < n; k++) {
    const a = (start + k) * 2;
    const b = (start + ((k + 1) % n)) * 2;
    twice += mesh.vertices[a]! * mesh.vertices[b + 1]! - mesh.vertices[b]! * mesh.vertices[a + 1]!;
  }
  return Math.abs(twice) / 2;
};

/**
 * The smallest and largest cross product of consecutive edges over every piece. A convex piece
 * turns one way only, so within a piece they never have opposite signs; `worst` is the largest
 * magnitude found on the minority side of any piece (0 for exactly convex pieces).
 */
export const worstTurn = (mesh: FractureMesh): number => {
  let worst = 0;
  for (let i = 0; i < mesh.count; i++) {
    const start = mesh.vertexStart[i]!;
    const n = mesh.vertexStart[i + 1]! - start;
    let min = 0;
    let max = 0;
    for (let k = 0; k < n; k++) {
      const a = (start + k) * 2;
      const b = (start + ((k + 1) % n)) * 2;
      const c = (start + ((k + 2) % n)) * 2;
      const cross =
        (mesh.vertices[b]! - mesh.vertices[a]!) * (mesh.vertices[c + 1]! - mesh.vertices[b + 1]!) -
        (mesh.vertices[b + 1]! - mesh.vertices[a + 1]!) * (mesh.vertices[c]! - mesh.vertices[b]!);
      min = Math.min(min, cross);
      max = Math.max(max, cross);
    }
    worst = Math.max(worst, Math.min(-min, max));
  }
  return worst;
};
