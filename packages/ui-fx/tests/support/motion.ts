import { FRAG_STRIDE, PHYS_LEN } from '../../src/core/motion/layout';
import type { FragmentPose } from '../../src/core/motion/pose';

export const newPose = (): FragmentPose => ({ x: 0, y: 0, rotation: 0, scale: 0, alpha: 0 });

/** A state buffer of `rows.length` fragments, each row its 12 values in layout order. */
export const stateOf = (...rows: readonly number[][]): Float32Array => {
  const state = new Float32Array(rows.length * FRAG_STRIDE);
  rows.forEach((row, i) => {
    state.set(row, i * FRAG_STRIDE);
  });
  return state;
};

/** A physics block from its values in layout order; the rest stays 0. */
export const physOf = (values: readonly number[]): Float32Array => {
  const phys = new Float32Array(PHYS_LEN);
  phys.set(values);
  return phys;
};
