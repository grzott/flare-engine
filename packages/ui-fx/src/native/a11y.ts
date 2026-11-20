import { AccessibilityInfo } from 'react-native';

export interface ExitA11yProps {
  readonly importantForAccessibility?: 'no-hide-descendants';
  readonly accessibilityElementsHidden?: true;
}

const HIDDEN: ExitA11yProps = {
  importantForAccessibility: 'no-hide-descendants',
  accessibilityElementsHidden: true,
};
const SHOWN: ExitA11yProps = {};

/** Props that take an exiting element out of the accessibility tree, on Android and on iOS. */
export function exitA11yProps(exiting: boolean): ExitA11yProps {
  return exiting ? HIDDEN : SHOWN;
}

/**
 * Move accessibility focus to the parent of an element that is about to be hidden. `parentTag` is
 * the parent's native tag, or `null` when it has none. React Native cannot say which view holds
 * accessibility focus, so this moves it whenever it is called.
 */
export function moveAccessibilityFocus(parentTag: number | null): void {
  if (parentTag !== null) AccessibilityInfo.setAccessibilityFocus(parentTag);
}
