import { useEffect, useState } from 'react';
import { Animated, FlatList, StyleSheet, Text, View } from 'react-native';

import { useCommissionAdvances } from '../hooks/useCommissionAdvances';
import type { CommissionAdvance } from '../types';
import { AdvanceCard } from './AdvanceCard';
import { colors } from '../../../theme';

interface Props {
  commissionId: string;
  role: 'artist' | 'client';
}

function SkeletonBox({ style }: { style?: object }) {
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[{ opacity }, style]} />;
}

function AdvanceCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonRow}>
        <SkeletonBox style={styles.skeletonBadge} />
        <SkeletonBox style={styles.skeletonDate} />
      </View>
      <SkeletonBox style={styles.skeletonImage} />
    </View>
  );
}

function AdvancesSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <AdvanceCardSkeleton />
      <AdvanceCardSkeleton />
    </View>
  );
}

const EMPTY_STATE: Record<'artist' | 'client', string> = {
  artist: 'Aún no has subido avances para esta comisión.',
  client: 'El artista aún no ha compartido avances.',
};

export function AdvancesList({ commissionId, role }: Props) {
  const { data: advances, isLoading } = useCommissionAdvances(commissionId);

  if (isLoading) {
    return <AdvancesSkeleton />;
  }

  if (!advances || advances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{EMPTY_STATE[role]}</Text>
      </View>
    );
  }

  return (
    <FlatList<CommissionAdvance>
      data={advances}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <AdvanceCard advance={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  separator: {
    height: 12,
  },
  skeletonBadge: {
    backgroundColor: colors.border,
    borderRadius: 12,
    height: 24,
    width: 80,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  skeletonContainer: {
    gap: 12,
  },
  skeletonDate: {
    backgroundColor: colors.border,
    borderRadius: 4,
    height: 12,
    width: 60,
  },
  skeletonImage: {
    backgroundColor: colors.border,
    borderRadius: 6,
    height: 160,
    width: '100%',
  },
  skeletonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
