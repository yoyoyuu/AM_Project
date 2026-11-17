import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { PendingCommissionCard } from '../components/PendingCommissionCard';
import { usePendingCommissions } from '../hooks/usePendingCommissions';
import type { CommissionWithDetails } from '../types';

const ERROR_MESSAGE =
  'No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo';
const EMPTY_MESSAGE = 'No tienes solicitudes pendientes';

export function ArtistCommissionsScreen() {
  const { user } = useAuth();
  const artistId = user?.id ?? '';

  const { data, isPending, isError, refetch, isRefetching } =
    usePendingCommissions(artistId);

  const commissions: CommissionWithDetails[] = data ?? [];

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C5CE7" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {ERROR_MESSAGE}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Solicitudes pendientes</Text>
      <FlatList
        contentContainerStyle={
          commissions.length === 0 ? styles.emptyList : styles.list
        }
        data={commissions}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{EMPTY_MESSAGE}</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#6C5CE7"
          />
        }
        renderItem={({ item }) => <PendingCommissionCard commission={item} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
    paddingTop: 16,
  },
  emptyList: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  title: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
