import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { catalogoErrors } from '../../../features/catalogo/errors';
import { MESSAGES } from '../../../features/catalogo/messages';
import { useMyServices } from '../../../features/catalogo/queries';
import type { Service } from '../../../features/catalogo/types';
import { useProfile } from '../../../features/auth/useProfile';
import { colors } from '../../../theme';

function ServiceCard({ service }: { service: Service }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/catalogo/${service.id}`)}
      style={styles.serviceCard}
    >
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceTitle}>{service.title}</Text>
        {service.status === 'paused' && (
          <Text style={styles.pausedLabel}>Pausado</Text>
        )}
      </View>
      {service.description && (
        <Text numberOfLines={2} style={styles.description}>
          {service.description}
        </Text>
      )}
      <View style={styles.serviceDetails}>
        <Text style={styles.detail}>${service.price_mxn} MXN</Text>
        <Text style={styles.detail}>
          Entrega: {service.delivery_days}{' '}
          {service.delivery_days === 1 ? 'día' : 'días'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CatalogoScreen() {
  const { isLoading: profileLoading, profile } = useProfile();
  const servicesQuery = useMyServices();
  const services = servicesQuery.data ?? [];
  const atLimit = services.length >= 20;

  if (profileLoading || servicesQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{MESSAGES.generic}</Text>
      </View>
    );
  }

  if (!profile.is_artist) {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Catálogo de servicios</Text>
        <Text style={styles.emptyText}>
          Activa tu perfil de artista para gestionar tu catálogo.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/artist-setup')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            Activar perfil de artista
          </Text>
        </Pressable>
      </View>
    );
  }

  if (servicesQuery.isError) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.error}>
          {catalogoErrors.handle(servicesQuery.error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Koma</Text>
      <Text style={styles.title}>Mi catálogo</Text>
      <Text style={styles.subtitle}>
        Servicios activos y pausados ({services.length}/20)
      </Text>
      <FlatList
        contentContainerStyle={
          services.length === 0 ? styles.emptyList : styles.list
        }
        data={services}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Aún no tienes servicios. Crea el primero para mostrarlo a tus
            clientes.
          </Text>
        }
        renderItem={({ item }) => <ServiceCard service={item} />}
        showsVerticalScrollIndicator={false}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: atLimit }}
        disabled={atLimit}
        onPress={() => router.push('/catalogo/nuevo')}
        style={[styles.primaryButton, atLimit && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>
          {atLimit ? MESSAGES.limitReached : 'Nuevo servicio'}
        </Text>
      </Pressable>
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
    padding: 24,
  },
  brand: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    marginBottom: 18,
    marginTop: 8,
  },
  list: {
    paddingBottom: 18,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  serviceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  pausedLabel: {
    backgroundColor: colors.neutralSoft,
    borderRadius: 6,
    color: colors.neutralText,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  serviceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  detail: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  disabledButton: {
    backgroundColor: colors.textMuted,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
