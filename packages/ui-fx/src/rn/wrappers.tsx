import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { FlareElementOptions } from '../runtime/element';
import { createFlareComponent, createFlarePressable } from './create-flare-component';

/** A `View` with the Flare element options. It reads the press point from `onTouchStart`. */
export const FlareView = /* @__PURE__ */ createFlareComponent(View);

/** A `Text` with the Flare element options. */
export const FlareText = /* @__PURE__ */ createFlareComponent(Text);

/** An `Image` with the Flare element options. */
export const FlareImage = /* @__PURE__ */ createFlareComponent(Image);

/** A `Pressable` with the Flare element options. It reads the press point from `onPressIn`. */
export const FlarePressable = /* @__PURE__ */ createFlarePressable(Pressable);

export type FlareButtonProps = ComponentPropsWithRef<typeof Pressable> &
  FlareElementOptions & {
    /** Rendered as an unstyled `Text`, in place of `children`. */
    label?: string;
  };

/** A `FlarePressable` that can take its content as a `label`. With `exitOn="press"` a press plays `exit`. */
export function FlareButton({ label, children, ...rest }: FlareButtonProps): ReactNode {
  return (
    <FlarePressable {...rest}>
      {label === undefined ? children : <Text>{label}</Text>}
    </FlarePressable>
  );
}
