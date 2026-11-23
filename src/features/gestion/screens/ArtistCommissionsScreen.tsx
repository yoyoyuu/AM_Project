import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { PendingCommissionCard } from '../components/PendingCommissionCard';
import { useActiveCommissions } from '../hooks/useActiveCommissions';
import { usePendingCommissions } from '../hooks/usePendingCommissions';
import type { CommissionWithDetails } from '../types';
import { colors } from '../../../theme';

export function ArtistCommissionsScreen() {
  const { user } = useAuth();
  const artistId = user?.id ?? '';

  const {
    data: pendingData,
    isPending: loadingPending,
    isError: errorPending,
    refetch: refetchPending,
    isRefetching: refetchingPending,
  } = usePendingCommissions(artistId);

  const {
    data: activeData,
    isPending: loadingActive,
    isError: errorActive,
    refetch: refetchActive,
    isRefetching: refetchingActive,
  } = useActiveCommissions(artistId);

  const pending: CommissionWithDetails[] = pendingData ?? [];
  const active: CommissionWithDetails[] = activeData ?? [];

  const isLoading = loadingPending || loadingActive;
  const isRefreshing = refetchingPending || refetchingActive;

  const handleRefresh = () => {
    void refetchPending();
    void refetchActive();
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* En progreso */}
      {(active.length > 0 || errorActive) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>En progreso</Text>
          {errorActive ? (
            <Text style={styles.errorText}>No se pudieron cargar las comisiones activas</Text>
          ) : (
            active.map((item) => (
              <PendingCommissionCard key={item.id} commission={item} />
            ))
          )}
        </View>
      )}

      {/* Solicitudes pendientes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solicitudes pendientes</Text>
        {errorPending ? (
          <Text style={styles.errorText}>No se pudieron cargar las solicitudes</Text>
        ) : pending.length === 0 ? (
          <Text style={styles.emptyText}>No tienes solicitudes pendientes</Text>
        ) : (
          pending.map((item) => (
            <PendingCommissionCard key={item.id} commission={item} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    paddingTop: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
});
