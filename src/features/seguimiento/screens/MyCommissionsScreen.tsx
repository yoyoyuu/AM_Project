import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { groupCommissions } from '../presenters';
import { useMyCommissions } from '../hooks/useMyCommissions';
import { CommissionListSkeleton } from '../components/CommissionListSkeleton';
import { CommissionsEmptyState } from '../components/CommissionsEmptyState';
import { CommissionsGroupSection } from '../components/CommissionsGroupSection';
import { colors } from '../../../theme';

export function MyCommissionsScreen() {
  const { user } = useAuth();
  const clientId = user?.id ?? '';

  const { data, isLoading, isError, refetch } = useMyCommissions(clientId);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handlePressItem = (id: string) => {
    router.push(`/(tabs)/commissions/${id}`);
  };

  const handleExploreArtists = () => {
    router.push('/(app)/buscar');
  };

  if (isLoading && !refreshing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <CommissionListSkeleton />
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>
          No se pudo cargar tus comisiones. Comprueba tu conexión e intenta de nuevo
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          onPress={() => void refetch()}
          accessibilityRole="button"
        >
          <Text style={styles.retryLabel}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const groups = groupCommissions(data ?? []);
  const isEmpty = groups.active.length === 0 && groups.pending.length === 0 && groups.finished.length === 0;

  if (isEmpty) {
    return (
      <View style={styles.container}>
        <CommissionsEmptyState onExploreArtists={handleExploreArtists} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
      }
    >
      <CommissionsGroupSection
        title="En curso"
        commissions={groups.active}
        onPressItem={handlePressItem}
      />
      <CommissionsGroupSection
        title="Pendientes"
        commissions={groups.pending}
        onPressItem={handlePressItem}
      />
      <CommissionsGroupSection
        title="Finalizadas"
        commissions={groups.finished}
        onPressItem={handlePressItem}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    paddingTop: 16,
  },
  errorText: {
    color: colors.text,
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.text,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonPressed: {
    backgroundColor: colors.text,
  },
  retryLabel: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
});
