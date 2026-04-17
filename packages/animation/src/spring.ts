/** Spring configuration. */
export interface SpringConfig {
  /** Spring stiffness (higher = faster oscillation). Default: 100. */
  stiffness: number;
  /** Damping coefficient (higher = less oscillation). Default: 10. */
  damping: number;
  /** Mass of the spring body. Default: 1. */
  mass: number;
}

/** Spring state. */
export interface Spring {
  /** Current value. */
  value: number;
  /** Current velocity. */
  velocity: number;
  /** Target value. */
  target: number;
  /** Configuration. */
  config: SpringConfig;
  /** Whether the spring has settled (within rest threshold). */
  atRest: boolean;
}

const REST_THRESHOLD = 0.001;
const VELOCITY_THRESHOLD = 0.001;

/** Create a spring with initial value. */
export function spring(value: number, target: number, config?: Partial<SpringConfig>): Spring {
  return {
    value,
    velocity: 0,
    target,
    config: {
      stiffness: config?.stiffness ?? 100,
      damping: config?.damping ?? 10,
      mass: config?.mass ?? 1,
    },
    atRest: value === target,
  };
}

/**
 * Update a spring by dt seconds. Returns the current value.
 * Uses semi-implicit Euler integration for stability.
 */
export function updateSpring(s: Spring, dt: number): number {
  if (s.atRest) return s.value;

  const { stiffness, damping, mass } = s.config;
  const displacement = s.value - s.target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * s.velocity;
  const acceleration = (springForce + dampingForce) / mass;

  // Semi-implicit Euler: update velocity first, then position
  s.velocity += acceleration * dt;
  s.value += s.velocity * dt;

  // Check if settled
  if (Math.abs(s.value - s.target) < REST_THRESHOLD && Math.abs(s.velocity) < VELOCITY_THRESHOLD) {
    s.value = s.target;
    s.velocity = 0;
    s.atRest = true;
  }

  return s.value;
}

/** Set a new target for the spring. Wakes it if at rest. */
export function setSpringTarget(s: Spring, target: number): void {
  s.target = target;
  s.atRest = false;
}

/** Reset both value and target, zeroing velocity. */
export function resetSpring(s: Spring, value: number): void {
  s.value = value;
  s.target = value;
  s.velocity = 0;
  s.atRest = true;
}
