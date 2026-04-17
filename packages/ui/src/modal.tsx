import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Panel } from './panel.js';

export interface ModalProps {
  visible: boolean;
  children?: ReactNode;
  /** Called when the backdrop is pressed. Return nothing to close, or do nothing to make it non-dismissable. */
  onBackdropPress?: () => void;
  /** Backdrop opacity 0..1. Defaults to 0.6. */
  backdropOpacity?: number;
}

/**
 * Overlay modal that renders a centered `Panel` with its children. Parent is
 * responsible for controlling visibility and (if desired) focus trapping via
 * the shared FocusManager.
 */
export function Modal({
  visible,
  children,
  onBackdropPress,
  backdropOpacity = 0.6,
}: ModalProps): ReactNode {
  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onBackdropPress}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
        }}
      />
      <Panel variant="elevated" padding="lg" style={{ minWidth: 240, maxWidth: '80%' }}>
        {children}
      </Panel>
    </View>
  );
}
