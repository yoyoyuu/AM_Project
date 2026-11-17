import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommissionWithDetails } from '../types';
import { CommissionStatusBadge } from './CommissionStatusBadge';

interface Props {
  commission: CommissionWithDetails;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PendingCommissionCard({ commission }: Props) {
  const handlePress = () => {
    router.push({
      pathname: '/artist/commissions/[commissionId]',
      params: { commissionId: commission.id },
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Comisión ${commission.service.title} de ${commission.client_profile?.handle ?? 'cliente'}`}
    >
      <View style={styles.row}>
        <Text style={styles.serviceTitle} numberOfLines={1}>
          {commission.service.title}
        </Text>
        <CommissionStatusBadge status={commission.status} />
      </View>

      <Text style={styles.clientHandle} numberOfLines={1}>
        {commission.client_profile ? `@${commission.client_profile.handle}` : 'Cliente desconocido'}
      </Text>

      <Text style={styles.date}>{formatDate(commission.created_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  clientHandle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
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
});
