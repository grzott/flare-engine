# @flare-engine/a11y

Central accessibility state for `@flare-engine/animation`, `@flare-engine/postfx`, and `@flare-engine/ui` to dampen or neutralize motion / contrast / scale per user preference. Light surface — full screen-reader pass deferred to 0.3.0. Hosts bridge OS prefs (`AccessibilityInfo.isReduceMotionEnabled`, `prefers-reduced-motion`) by calling `update()` on startup.

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

See [API spec](../../docs/design/api-specs.md#flare-enginea11y--2kb-raw-light) and [skill reference](../../.github/skills/flare-a11y/SKILL.md).

## License

MIT
