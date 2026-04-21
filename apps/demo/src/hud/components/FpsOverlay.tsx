import { Label } from '@flare-engine/ui';
import React from 'react';
import { Pressable } from 'react-native';
import { toggleShowFps } from '../fps-state';
import { styles } from '../styles';
import { useFpsLine, useShowFps } from '../use-fps-state';

/** Top-left FPS overlay. Long-press toggles visibility. */
export const FpsOverlay = React.memo(function FpsOverlay(): React.ReactElement {
  const fpsLine = useFpsLine();
  const showFps = useShowFps();
  return (
    <Pressable
      onLongPress={toggleShowFps}
      delayLongPress={400}
      style={styles.fpsHotspot}
      accessibilityLabel="Toggle FPS overlay"
    >
      {showFps && fpsLine ? (
        <Label variant="xs" tone="success" mono>
          {fpsLine}
        </Label>
      ) : null}
    </Pressable>
  );
});
