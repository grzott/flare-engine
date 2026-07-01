export {
  type SpriteAnimatorState,
  createSpriteAnimator,
  playAnimation,
  stopAnimation,
  pauseAnimation,
  resumeAnimation,
  updateAnimator,
  getCurrentFrame,
} from './sprite-animator.js';

export {
  type Tween,
  tween,
  updateTween,
  chainTween,
  resetTween,
} from './tween.js';

export {
  type SpringConfig,
  type Spring,
  spring,
  updateSpring,
  setSpringTarget,
  resetSpring,
} from './spring.js';

export {
  type TweenManager,
  createTweenManager,
  addTween,
  updateTweens,
  clearTweens,
} from './tween-manager.js';

export {
  type PeriodicTween,
  periodicTween,
  updatePeriodicTween,
  resetPeriodicTween,
} from './periodic.js';

export {
  type StepSequenceStep,
  type StepSequence,
  createStepSequence,
  tickStepSequence,
  resetStepSequence,
} from './step-sequence.js';

export {
  type TimedModifier,
  createTimedModifier,
  tickModifier,
  isModifierActive,
  applyModifier,
} from './timed-modifier.js';
