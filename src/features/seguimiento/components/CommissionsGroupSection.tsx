import { StyleSheet, Text, View } from 'react-native';

import type { ClientCommissionSummary } from '../types';
import { CommissionCard } from './CommissionCard';

interface Props {
  title: string;
  commissions: ClientCommissionSummary[];
  onPressItem: (id: string) => void;
}

export function CommissionsGroupSection({ title, commissions, onPressItem }: Props) {
  if (commissions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {commissions.map((commission) => (
        <CommissionCard
          key={commission.id}
          commission={commission}
          onPress={() => onPressItem(commission.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginHorizontal: 16,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
});
