import { createFlareComponent } from './create-flare-component';

/** A `<div>` with the Flare element options. */
export const FlareDiv = /* @__PURE__ */ createFlareComponent('div');

/** A `<span>` with the Flare element options. */
export const FlareSpan = /* @__PURE__ */ createFlareComponent('span');

/** A `<button>` with the Flare element options. With `exitOn="press"` a click plays `exit`. */
export const FlareButton = /* @__PURE__ */ createFlareComponent('button');

/** An `<img>` with the Flare element options. */
export const FlareImg = /* @__PURE__ */ createFlareComponent('img');

/** An `<li>` with the Flare element options. */
export const FlareLi = /* @__PURE__ */ createFlareComponent('li');
