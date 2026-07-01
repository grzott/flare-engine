# @flare-engine/a11y

Central accessibility state for `@flare-engine/animation`, `@flare-engine/postfx`, and `@flare-engine/ui` to dampen or neutralize motion / contrast / scale per user preference. Includes WCAG 2.x contrast-ratio classification and OKLab ΔE color-distinguishability audit. Light surface — full screen-reader pass deferred to 0.3.0. Hosts bridge OS prefs (`AccessibilityInfo.isReduceMotionEnabled`, `prefers-reduced-motion`) by calling `update()` on startup.

## Install

```sh
bun add @flare-engine/a11y
```

## Usage

```ts
import { A11yManager, motionScale, dampenedMotion, pickContrast } from '@flare-engine/a11y';

const a11y = new A11yManager();
a11y.update({ reducedMotion: true, contrast: 'high' });
a11y.onChange.add((settings) => console.log(settings));

const shakeIntensity = motionScale(a11y.settings, 8); // 0 under reduced motion
const vignettePulse = dampenedMotion(a11y.settings, 0.4); // softens but preserves
const fg = pickContrast(a11y.settings, 0xff_cc_cc_cc, 0xff_ff_ff_ff);
```

WCAG contrast + OKLab ΔE audit:

```ts
import { auditColors, contrastRatio, wcagLevel } from '@flare-engine/a11y';
import { Color } from '@flare-engine/math';

const result = auditColors(Color.fromHex('#767676'), Color.WHITE);
// { contrastRatio: ~4.54, wcagLevel: 'AA', deltaE: ..., distinguishable: true }

const ratio = contrastRatio(Color.BLACK, Color.WHITE); // 21
const level = wcagLevel(ratio); // 'AAA'
const level2 = wcagLevel(ratio, true); // 'AAA' (large text)
```

See [API spec](../../docs/design/api-specs.md#flare-enginea11y--2kb-raw-light).

## License

MIT
