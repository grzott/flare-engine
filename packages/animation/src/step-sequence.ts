export interface StepSequenceStep {
  readonly duration: number;
}

export interface StepSequence {
  readonly steps: readonly StepSequenceStep[];
  current: number;
  elapsed: number;
}

export function createStepSequence(steps: readonly StepSequenceStep[]): StepSequence {
  if (steps.length === 0) throw new Error('createStepSequence: steps must not be empty');
  for (let i = 0; i < steps.length; i++) {
    if ((steps[i]?.duration ?? 0) <= 0)
      throw new Error('createStepSequence: each step duration must be > 0');
  }
  return { steps, current: 0, elapsed: 0 };
}

export function tickStepSequence(seq: StepSequence, dt: number): number {
  seq.elapsed += dt;
  while (seq.elapsed >= (seq.steps[seq.current]?.duration ?? 0)) {
    seq.elapsed -= seq.steps[seq.current]!.duration;
    seq.current = (seq.current + 1) % seq.steps.length;
  }
  return seq.current;
}

export function resetStepSequence(seq: StepSequence): void {
  seq.current = 0;
  seq.elapsed = 0;
}
