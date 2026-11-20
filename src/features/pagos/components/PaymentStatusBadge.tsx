import { StyleSheet, Text, View } from 'react-native';

import { getPaymentBadge } from '../presenters';
import type { PaymentStatus } from '../types';

interface Props {
  status: PaymentStatus;
}

const COLOR_MAP = {
  warning: { background: '#FEF3C7', text: '#92400E' },
  info:    { background: '#DBEAFE', text: '#1E40AF' },
  error:   { background: '#FEE2E2', text: '#991B1B' },
  success: { background: '#D1FAE5', text: '#065F46' },
} as const;

export function PaymentStatusBadge({ status }: Props) {
  const { label, colorKey } = getPaymentBadge(status);
  const { background, text } = COLOR_MAP[colorKey];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
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
