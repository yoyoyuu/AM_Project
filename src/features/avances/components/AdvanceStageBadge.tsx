import { StyleSheet, Text, View } from 'react-native';

import { getStageName } from '../../gestion/stateMachine';
import type { CreativeStage } from '../../gestion/types';

interface Props {
  stage: CreativeStage;
}

const STAGE_COLORS: Record<CreativeStage, { bg: string; text: string }> = {
  SKETCH: { bg: '#EFF6FF', text: '#1D4ED8' },
  LINEART: { bg: '#ECFDF5', text: '#059669' },
  FINAL: { bg: '#F5F3FF', text: '#7C3AED' },
};

export function AdvanceStageBadge({ stage }: Props) {
  const { bg, text } = STAGE_COLORS[stage];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{getStageName(stage)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
