export {
  type AgentField,
  createStigmergy,
  decideTurn,
  SENSE_DEFAULTS,
  type SenseConfig,
  type StigmergyConfig,
  senseAt,
} from './agent/stigmergy.js';
export { createScalarField, type ScalarField } from './field/scalar-field.js';
export { type ClosestPair, createNBodySystem, type NBodySystem } from './integrate/nbody.js';
export { type AccelFn, leapfrogInto, verletStep } from './integrate/verlet.js';
export { createRipplePool, type RipplePool } from './wave/wave-packet-pool.js';
