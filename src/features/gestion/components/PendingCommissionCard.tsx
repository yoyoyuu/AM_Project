import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommissionWithDetails } from '../types';
import { CommissionStatusBadge } from './CommissionStatusBadge';
import { colors } from '../../../theme';

interface Props {
  commission: CommissionWithDetails;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PendingCommissionCard({ commission }: Props) {
  const handlePress = () => {
    if (commission.status === 'PENDIENTE') {
      router.push({
        pathname: '/artist/commissions/[commissionId]',
        params: { commissionId: commission.id },
      });
    } else {
      router.push({
        pathname: '/artist/commissions/[commissionId]/work',
        params: { commissionId: commission.id },
      });
    }
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
        {commission.client_profile?.handle
          ? `@${commission.client_profile.handle}`
          : commission.client_profile?.display_name ?? 'Cliente desconocido'}
      </Text>

      <Text style={styles.date}>{formatDate(commission.created_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
  },
  cardPressed: {
    backgroundColor: colors.background,
  },
  clientHandle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
