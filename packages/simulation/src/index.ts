export { type ClosestPair, type NBodySystem, createNBodySystem } from './integrate/nbody.js';

export { type AccelFn, leapfrogInto, verletStep } from './integrate/verlet.js';

export { type RipplePool, createRipplePool } from './wave/wave-packet-pool.js';

export { type ScalarField, createScalarField } from './field/scalar-field.js';

export {
  type AgentField,
  type StigmergyConfig,
  type SenseConfig,
  SENSE_DEFAULTS,
  createStigmergy,
  senseAt,
  decideTurn,
} from './agent/stigmergy.js';
