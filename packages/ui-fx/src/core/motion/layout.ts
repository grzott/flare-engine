/**
 * Floats per fragment in the state buffer `initFragmentsInto` fills. Fragment `i` starts at
 * `i * FRAG_STRIDE`; the offsets below index into it.
 */
export const FRAG_STRIDE = 12;

/** Home position, the piece's centroid, in element pixels. */
export const HX = 0;
export const HY = 1;
/** Launch velocity in px/s. */
export const VX = 2;
export const VY = 3;
/** Rotation at release, in radians. */
export const A0 = 4;
/** Angular velocity at release, in rad/s. */
export const OMEGA = 5;
/** Seconds from the start of the run until the piece is released. */
export const DELAY = 6;
/** Seconds the piece lives after its release. */
export const LIFE = 7;
export const MASS = 8;
/** Fake depth velocity, -1..1; `DEPTH` turns it into a scale change per second. */
export const VZ = 9;
/** Index of the piece in the mesh it came from. */
export const SRC = 10;
export const CX = 11;

/** Length of the physics block `packPhysicsInto` fills; the last two floats are spare. */
export const PHYS_LEN = 16;

/** Gravity in px/s². */
export const GX = 0;
export const GY = 1;
/** Linear and angular drag, per second. */
export const DRAG = 2;
export const ADRAG = 3;
export const DEPTH = 4;
/** Opacity at release and at the end of life. */
export const OP0 = 5;
export const OP1 = 6;
/** Scale at release and at the end of life. */
export const SC0 = 7;
export const SC1 = 8;
/** Fraction of a piece's life at which its opacity starts to change. */
export const FADE_START = 9;
/** How time maps onto the motion: 0 forward, 1 rewind, 2 home, 3 spring-home. */
export const REVERSE_MODE = 10;
/** The spring-home spring: natural frequency in rad/s and damping ratio. */
export const OMEGA0 = 11;
export const ZETA = 12;
/** Seconds the whole run lasts: the latest release plus the longest life. */
export const TOTAL = 13;
