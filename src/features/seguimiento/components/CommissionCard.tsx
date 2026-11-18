import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeDate } from '../presenters';
import type { ClientCommissionSummary } from '../types';
import { CommissionStatusBadge } from './CommissionStatusBadge';

const STAGE_LABEL: Record<string, string> = {
  SKETCH:  'Boceto',
  LINEART: 'Delineado',
  FINAL:   'Color / Acabado final',
};

interface Props {
  commission: ClientCommissionSummary;
  onPress: () => void;
}

export function CommissionCard({ commission, onPress }: Props) {
  const { service_title, artist_handle, status, current_stage, updated_at } = commission;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Comisión ${service_title} con @${artist_handle}`}
    >
      <View style={styles.row}>
        <Text style={styles.serviceTitle} numberOfLines={1}>
          {service_title}
        </Text>
        <CommissionStatusBadge status={status} />
      </View>

      <Text style={styles.artistHandle} numberOfLines={1}>
        @{artist_handle}
      </Text>

      {status === 'EN_PROGRESO' && current_stage !== null && (
        <Text style={styles.stage}>
          Etapa: {STAGE_LABEL[current_stage] ?? current_stage}
        </Text>
      )}

      <Text style={styles.date}>{formatRelativeDate(updated_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  artistHandle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
  },
  cardPressed: {
    backgroundColor: '#F9FAFB',
  },
  date: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 6,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceTitle: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  stage: {
    color: '#3B82F6',
    fontSize: 12,
    marginTop: 4,
  },
});
