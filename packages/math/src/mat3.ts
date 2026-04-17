import type { Transform2D } from './transform2d.js';

/**
 * 3x3 matrix stored in column-major order on Float32Array.
 * Layout: [m00, m10, m20, m01, m11, m21, m02, m12, m22]
 *
 * | m00 m01 m02 |     indices: | 0 3 6 |
 * | m10 m11 m12 |              | 1 4 7 |
 * | m20 m21 m22 |              | 2 5 8 |
 */
export type Mat3 = Float32Array;

export const Mat3 = {
  /** Creates a new identity matrix. */
  create(): Mat3 {
    const m = new Float32Array(9);
    m[0] = 1;
    m[4] = 1;
    m[8] = 1;
    return m;
  },

  /** Sets m to identity. */
  identity(m: Mat3): Mat3 {
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 1;
    m[5] = 0;
    m[6] = 0;
    m[7] = 0;
    m[8] = 1;
    return m;
  },

  /** Multiplies a * b, writes into out (or allocates). */
  multiply(a: Mat3, b: Mat3, out?: Mat3): Mat3 {
    const a00 = a[0]!,
      a01 = a[3]!,
      a02 = a[6]!;
    const a10 = a[1]!,
      a11 = a[4]!,
      a12 = a[7]!;
    const a20 = a[2]!,
      a21 = a[5]!,
      a22 = a[8]!;

    const b00 = b[0]!,
      b01 = b[3]!,
      b02 = b[6]!;
    const b10 = b[1]!,
      b11 = b[4]!,
      b12 = b[7]!;
    const b20 = b[2]!,
      b21 = b[5]!,
      b22 = b[8]!;

    const o = out ?? new Float32Array(9);
    o[0] = a00 * b00 + a01 * b10 + a02 * b20;
    o[1] = a10 * b00 + a11 * b10 + a12 * b20;
    o[2] = a20 * b00 + a21 * b10 + a22 * b20;
    o[3] = a00 * b01 + a01 * b11 + a02 * b21;
    o[4] = a10 * b01 + a11 * b11 + a12 * b21;
    o[5] = a20 * b01 + a21 * b11 + a22 * b21;
    o[6] = a00 * b02 + a01 * b12 + a02 * b22;
    o[7] = a10 * b02 + a11 * b12 + a12 * b22;
    o[8] = a20 * b02 + a21 * b12 + a22 * b22;
    return o;
  },

  /** Creates a translation matrix. */
  translate(tx: number, ty: number, out?: Mat3): Mat3 {
    const m = out ?? new Float32Array(9);
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 1;
    m[5] = 0;
    m[6] = tx;
    m[7] = ty;
    m[8] = 1;
    return m;
  },

  /** Creates a rotation matrix (radians). */
  rotate(angle: number, out?: Mat3): Mat3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = out ?? new Float32Array(9);
    m[0] = c;
    m[1] = s;
    m[2] = 0;
    m[3] = -s;
    m[4] = c;
    m[5] = 0;
    m[6] = 0;
    m[7] = 0;
    m[8] = 1;
    return m;
  },

  /** Creates a scale matrix. */
  scale(sx: number, sy: number, out?: Mat3): Mat3 {
    const m = out ?? new Float32Array(9);
    m[0] = sx;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = sy;
    m[5] = 0;
    m[6] = 0;
    m[7] = 0;
    m[8] = 1;
    return m;
  },

  /** Inverts the matrix. Returns null if singular. */
  invert(m: Mat3, out?: Mat3): Mat3 | null {
    const a00 = m[0]!,
      a01 = m[3]!,
      a02 = m[6]!;
    const a10 = m[1]!,
      a11 = m[4]!,
      a12 = m[7]!;
    const a20 = m[2]!,
      a21 = m[5]!,
      a22 = m[8]!;

    const det =
      a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20);

    if (Math.abs(det) < 1e-8) return null;

    const invDet = 1 / det;
    const o = out ?? new Float32Array(9);
    o[0] = (a11 * a22 - a12 * a21) * invDet;
    o[1] = (a12 * a20 - a10 * a22) * invDet;
    o[2] = (a10 * a21 - a11 * a20) * invDet;
    o[3] = (a02 * a21 - a01 * a22) * invDet;
    o[4] = (a00 * a22 - a02 * a20) * invDet;
    o[5] = (a01 * a20 - a00 * a21) * invDet;
    o[6] = (a01 * a12 - a02 * a11) * invDet;
    o[7] = (a02 * a10 - a00 * a12) * invDet;
    o[8] = (a00 * a11 - a01 * a10) * invDet;
    return o;
  },

  /** Builds a matrix from a Transform2D (TRS order: translate * rotate * scale). */
  fromTransform(t: Transform2D, out?: Mat3): Mat3 {
    const c = Math.cos(t.rotation);
    const s = Math.sin(t.rotation);
    const sx = t.scale.x;
    const sy = t.scale.y;
    const m = out ?? new Float32Array(9);
    m[0] = c * sx;
    m[1] = s * sx;
    m[2] = 0;
    m[3] = -s * sy;
    m[4] = c * sy;
    m[5] = 0;
    m[6] = t.position.x;
    m[7] = t.position.y;
    m[8] = 1;
    return m;
  },
} as const;
