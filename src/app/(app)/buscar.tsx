import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { catalogoErrors } from '../../features/catalogo/errors';
import { MESSAGES } from '../../features/catalogo/messages';
import { useArtistPublicProfile } from '../../features/catalogo/queries';
import { searchHandleSchema } from '../../features/catalogo/schemas';
import { colors } from '../../theme';

export default function SearchArtistScreen() {
  const [query, setQuery] = useState('');
  const [submittedHandle, setSubmittedHandle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const profileQuery = useArtistPublicProfile(submittedHandle);
  const hasSearched = submittedHandle.length > 0;
  const profile = profileQuery.data;

  const handleSearch = () => {
    const parsed = searchHandleSchema.safeParse({ query });

    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? MESSAGES.requiredFields);
      setSubmittedHandle('');
      return;
    }

    setValidationError(null);
    setSubmittedHandle(parsed.data.query);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Buscar artista</Text>
        <Text style={styles.subtitle}>
          Encuentra un artista por su identificador público.
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="@handle"
            returnKeyType="search"
            style={[styles.input, validationError && styles.inputError]}
            value={query}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleSearch}
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonText}>Buscar</Text>
          </Pressable>
        </View>

        {validationError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        )}

        {hasSearched && profileQuery.isFetching && (
          <View style={styles.status}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {hasSearched && profileQuery.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {catalogoErrors.handle(profileQuery.error)}
          </Text>
        )}

        {hasSearched && !profileQuery.isFetching && !profileQuery.isError && profile === null && (
          <Text style={styles.emptyMessage}>{MESSAGES.handleNotFound}</Text>
        )}

        {hasSearched && !profileQuery.isFetching && !profileQuery.isError && profile && (
          <View style={styles.profile}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>{profile.display_name}</Text>
              <Text style={styles.handle}>@{profile.handle}</Text>
            </View>

            <Text style={styles.sectionTitle}>Catálogo</Text>
            {profile.services.length === 0 ? (
              <Text style={styles.emptyMessage}>{MESSAGES.catalogEmpty}</Text>
            ) : (
              profile.services.map((service) => (
                <View key={service.id} style={styles.serviceCard}>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                  {service.description && (
                    <Text style={styles.description}>
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
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/commission/request/[serviceId]',
                        params: {
                          serviceId: service.id,
                          handle: profile.handle,
                          artistId: profile.artist_id,
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.requestButton,
                      pressed && styles.requestButtonPressed,
                    ]}
                  >
                    <Text style={styles.requestButtonText}>Solicitar comisión</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>Términos de servicio</Text>
            <Text style={profile.tos === null ? styles.emptyMessage : styles.tos}>
              {profile.tos ?? MESSAGES.noTos}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
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
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 20,
    marginTop: 8,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  input: {
    borderColor: colors.borderStrong,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    marginLeft: 10,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  searchButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  status: {
    alignItems: 'center',
    padding: 28,
  },
  emptyMessage: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
  },
  profile: {
    marginTop: 28,
  },
  profileHeader: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
    padding: 18,
  },
  profileName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  handle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 24,
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
  tos: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  requestButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
  },
  requestButtonPressed: {
    opacity: 0.85,
  },
  requestButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
});
