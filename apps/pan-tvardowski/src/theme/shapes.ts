const stroke = { thin: 1, medium: 1.5, thick: 2, veryThick: 3 } as const;

const enemySmall = { r: 10 } as const;
const enemyMedium = { r: 14 } as const;
const enemyLarge = { r: 18 } as const;
const minibossMedium = { r: 30 } as const;
const minibossLarge = { r: 36 } as const;
const minibossHuge = { r: 40, rInner: 12 } as const;
const bossSmall = { r: 48 } as const;
const bossLarge = { r: 52 } as const;
const eye = { r: 2 } as const;
const eyeSmall = { r: 1.5 } as const;

export const shapes = {
  stroke,
  enemySmall,
  enemyMedium,
  enemyLarge,
  minibossMedium,
  minibossLarge,
  minibossHuge,
  bossSmall,
  bossLarge,
  eye,
  eyeSmall,
} as const;
