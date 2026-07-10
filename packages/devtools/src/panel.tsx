import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useDevtools, useEntityInspector, useTimeScrub } from './hooks.js';

/**
 * DevtoolsPanel — full web-side panel. Renders the entity tree, scrub
 * controls, and buffer depth. No-op on native (renders `null`).
 */
export function DevtoolsPanel(): ReactNode {
  if (Platform.OS !== 'web') return null;
  return <PanelBody />;
}

function PanelBody(): ReactNode {
  const { buffer } = useDevtools();
  const { entities, selected, select } = useEntityInspector();
  const scrub = useTimeScrub();

  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 4,
        minWidth: 200,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Devtools</Text>
      <Text style={{ color: '#ccc' }}>
        buffer {buffer.length}/{buffer.size}
      </Text>
      <Text style={{ color: '#ccc' }}>
        {scrub.paused ? 'paused' : 'running'}
        {scrub.scrubbing ? ' (scrub)' : ''}
      </Text>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <DevButton label="Pause" onPress={scrub.pause} />
        <DevButton label="Step" onPress={scrub.step} />
        <DevButton label="Resume" onPress={scrub.resume} />
      </View>
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: '#fff' }}>entities ({entities.length})</Text>
        {entities.slice(0, 20).map((id) => (
          <Pressable key={id} onPress={() => select(id)}>
            <Text style={{ color: id === selected ? '#ff0' : '#fff' }}>#{id}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 4,
        backgroundColor: '#444',
        borderRadius: 2,
      }}
    >
      <Text style={{ color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}
