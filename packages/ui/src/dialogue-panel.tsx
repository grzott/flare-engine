import type { ReactNode } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { Button } from './button.js';
import { Label } from './label.js';
import { Panel } from './panel.js';
import { useTheme } from './theme.js';

export interface DialogueChoice {
  /** Display label (already localized by the caller). */
  readonly label: string;
  /** Called when the player selects this choice. */
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export interface DialoguePanelProps {
  /** Speaker name — rendered above the text. */
  readonly speaker: string;
  /** Line text — rendered in the body. */
  readonly text: string;
  /**
   * Portrait node. Typically an `<Image>` or a Skia/shape avatar keyed by
   * `LineNode.speakerPortraitKey`. When omitted, the portrait slot collapses.
   */
  readonly portrait?: ReactNode;
  /**
   * Optional choices. When present, renders a `Button` per option; when
   * absent, the panel tap-advances via `onAdvance`.
   */
  readonly choices?: readonly DialogueChoice[];
  /** Advance callback — used only when `choices` is empty / omitted. */
  readonly onAdvance?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Dialogue panel with a portrait slot. Pairs with `@flare-engine/dialogue`
 * — subscribe to `runner.onLine` and pass `speakerPortraitKey` → your
 * portrait resolver → `portrait` here.
 *
 * Portrait resolution is caller-owned so the UI kit stays asset-agnostic.
 */
export function DialoguePanel({
  speaker,
  text,
  portrait,
  choices,
  onAdvance,
  style,
}: DialoguePanelProps): ReactNode {
  const theme = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {portrait !== undefined ? (
        <View style={{ marginRight: theme.spacing.md }}>{portrait}</View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Label variant="sm" tone="accent" style={{ marginBottom: theme.spacing.xs }}>
          {speaker}
        </Label>
        <Label variant="md">{text}</Label>
        {choices && choices.length > 0 ? (
          <View style={{ marginTop: theme.spacing.md }}>
            {choices.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static choice list, never reordered
              <View key={`${c.label}-${i}`} style={{ marginTop: i === 0 ? 0 : theme.spacing.xs }}>
                <Button
                  label={c.label}
                  onPress={c.onPress}
                  disabled={c.disabled}
                  variant="secondary"
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (choices && choices.length > 0) {
    return (
      <Panel variant="elevated" padding="md" style={style}>
        {body}
      </Panel>
    );
  }

  return (
    <Pressable onPress={onAdvance}>
      <Panel variant="elevated" padding="md" style={style}>
        {body}
      </Panel>
    </Pressable>
  );
}
