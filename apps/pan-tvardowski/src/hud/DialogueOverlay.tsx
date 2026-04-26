import type { LocalizationManager } from '@flare-engine/localization';
import { DialoguePanel, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PORTRAITS_MANIFEST, resolvePortraitViaManifest } from '../assets';
import type { DialogueController } from '../dialogue';
import { type DialogueHudState, gameState, stateChanged } from '../state';

export interface DialogueOverlayProps {
  localization: LocalizationManager;
  controller: DialogueController;
}

/**
 * Renders the dialogue overlay when `gameState.dialogue` is non-null. Uses
 * `<DialoguePanel>` from `@flare-engine/ui` with a shape-portrait placeholder
 * resolved from `PORTRAIT_MANIFEST` via `portraitKey`. Speaker + body text are
 * resolved through the LocalizationManager so language switch is instantaneous.
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

  const shapes = resolvePortraitViaManifest(PORTRAITS_MANIFEST, line.portraitKey ?? '');

  return (
    <ThemeProvider theme={darkTheme}>
      <View style={styles.root}>
        <DialoguePanel
          speaker={localization.t(line.speakerKey)}
          text={localization.t(line.textKey)}
          portrait={
            shapes !== undefined ? (
              <View style={styles.portraitSlot}>
                {/* Shape portrait placeholder: 48×48 box. Actual Skia draw is
                    device-verified — the manifest drives the spec, not inline art. */}
                <View
                  style={[
                    styles.portraitBox,
                    {
                      backgroundColor: `#${(shapes[0]?.fill ?? 0xff333333).toString(16).slice(2)}`,
                    },
                  ]}
                />
              </View>
            ) : undefined
          }
          onAdvance={() => controller.advance()}
          style={styles.panel}
        />
      </View>
    </ThemeProvider>
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
  panel: {
    borderWidth: 2,
    borderColor: '#d6a54e',
  },
  portraitSlot: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitBox: {
    width: 44,
    height: 44,
    borderRadius: 4,
    opacity: 0.9,
  },
});
