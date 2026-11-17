import { StyleSheet, Text, View } from 'react-native';

import type { CommissionStatus } from '../types';

interface Props {
  status: CommissionStatus;
}

const LABEL: Record<CommissionStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  RECHAZADA: 'Rechazada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  EN_REVISION: 'En revisión',
};

const COLOR: Record<CommissionStatus, { background: string; text: string }> = {
  PENDIENTE: { background: '#FEF3C7', text: '#92400E' },
  EN_PROGRESO: { background: '#DBEAFE', text: '#1E40AF' },
  RECHAZADA: { background: '#FEE2E2', text: '#991B1B' },
  COMPLETADA: { background: '#D1FAE5', text: '#065F46' },
  CANCELADA: { background: '#F3F4F6', text: '#374151' },
  EN_REVISION: { background: '#EDE9FE', text: '#5B21B6' },
};

export function CommissionStatusBadge({ status }: Props) {
  const { background, text } = COLOR[status];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: text }]}>{LABEL[status]}</Text>
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
