import type { LocalizationManager } from '@flare-engine/localization';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DialogueController } from '../dialogue';
import { type DialogueHudState, gameState, stateChanged } from '../state';

export interface DialogueOverlayProps {
  localization: LocalizationManager;
  controller: DialogueController;
}

/**
 * Renders the dialogue overlay when `gameState.dialogue` is non-null. Consumes
 * one tap per line via the dialogue controller; speaker + body are resolved
 * through the LocalizationManager so language switch is instantaneous.
 */
export function DialogueOverlay({
  localization,
  controller,
}: DialogueOverlayProps): React.ReactElement | null {
  const [line, setLine] = useState<DialogueHudState | null>(gameState.dialogue);

  useEffect(() => {
    const off = stateChanged.add(() => setLine(gameState.dialogue));
    return () => off();
  }, []);

  if (!line) return null;

  return (
    <Pressable style={styles.root} onPress={() => controller.advance()}>
      <View style={styles.box}>
        <Text style={styles.speaker}>{localization.t(line.speakerKey)}</Text>
        <Text style={styles.text}>{localization.t(line.textKey)}</Text>
        <Text style={styles.hint}>{localization.t('hud.dialogue.continue')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 24,
  },
  box: {
    borderWidth: 2,
    borderColor: '#d6a54e',
    backgroundColor: 'rgba(14,10,6,0.92)',
    padding: 16,
    borderRadius: 4,
  },
  speaker: {
    color: '#d6a54e',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  text: {
    color: '#eae1cc',
    fontSize: 15,
    lineHeight: 20,
  },
  hint: {
    color: '#9a8a66',
    fontSize: 11,
    marginTop: 12,
    textAlign: 'right',
  },
});
