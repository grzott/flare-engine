import { Label, Panel } from '@flare-engine/ui';
import React from 'react';
import { Pressable, View } from 'react-native';
import { menuActions } from '../menu-actions';
import { styles } from '../styles';
import { useDialogueLine } from '../use-dialogue';

/** Bottom-of-screen dialogue panel. Tap advances to next line. */
export const DialogueOverlay = React.memo(function DialogueOverlay(props: {
  active: boolean;
}): React.ReactElement | null {
  const dialogue = useDialogueLine();
  if (!props.active || !dialogue) return null;
  return (
    <View style={styles.dialogueWrap} pointerEvents="box-none">
      <Pressable onPress={menuActions.onDialogueAdvance} style={styles.dialoguePressable}>
        <Panel>
          <Label variant="sm" tone="warning" style={styles.dialogueSpeaker}>
            {dialogue.speaker}
          </Label>
          <Label variant="md" style={styles.dialogueText}>
            {dialogue.text}
          </Label>
          <Label variant="xs" tone="muted" style={styles.dialogueHint}>
            Tap to continue
          </Label>
        </Panel>
      </Pressable>
    </View>
  );
});
