import { StyleSheet, Text, View } from 'react-native';

import { formatRelativeDate } from '../../seguimiento/presenters';
import type { CommissionAdvance } from '../types';
import { AdvanceImageGrid } from './AdvanceImageGrid';
import { AdvanceStageBadge } from './AdvanceStageBadge';
import { colors } from '../../../theme';

interface Props {
  advance: CommissionAdvance;
}

export function AdvanceCard({ advance }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AdvanceStageBadge stage={advance.stage} />
        <Text style={styles.date}>{formatRelativeDate(advance.created_at)}</Text>
      </View>

      <AdvanceImageGrid files={advance.files} />

      {advance.note !== null && (
        <Text style={styles.note}>{advance.note}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  date: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  note: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
