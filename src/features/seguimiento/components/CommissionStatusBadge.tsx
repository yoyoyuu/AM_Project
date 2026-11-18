import { StyleSheet, Text, View } from 'react-native';

import { getStatusBadge } from '../presenters';
import type { CommissionStatus } from '../types';

interface Props {
  status: CommissionStatus;
}

const COLOR_MAP: Record<string, { background: string; text: string }> = {
  info:    { background: '#DBEAFE', text: '#1E40AF' },
  warning: { background: '#FEF3C7', text: '#92400E' },
  success: { background: '#D1FAE5', text: '#065F46' },
  error:   { background: '#FEE2E2', text: '#991B1B' },
  neutral: { background: '#F3F4F6', text: '#374151' },
};

export function CommissionStatusBadge({ status }: Props) {
  const { label, colorKey } = getStatusBadge(status);
  const { background, text } = COLOR_MAP[colorKey];
  return (
    <View
      style={[styles.badge, { backgroundColor: background }]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
