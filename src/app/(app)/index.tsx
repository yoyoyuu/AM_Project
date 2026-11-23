import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';

import { signOut } from '../../features/auth/api';
import { useAppMode, type AppMode } from '../../features/auth/useAppMode';
import { useProfile } from '../../features/auth/useProfile';
import { NotificationPermissionPrompt } from '../../features/notificaciones/components/NotificationPermissionPrompt';
import { NotificationSettingsRow } from '../../features/notificaciones/components/NotificationSettingsRow';
import { colors } from '../../theme';

const showToast = (message: string) => ToastAndroid.show(message, ToastAndroid.SHORT);

export default function AppHomeScreen() {
  const { isLoading, profile } = useProfile();
  const { loading: modeLoading, mode, setMode } = useAppMode();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);

  const handleSignOut = async () => {
    setLogoutError(null);
    setIsSigningOut(true);

    const result = await signOut();
    if (result.error !== null) {
      setLogoutError(result.error);
      setIsSigningOut(false);
      return;
    }

    router.replace('/login');
  };

  const handleModeChange = async (nextMode: AppMode) => {
    setModeError(null);
    setIsChangingMode(true);

    try {
      await setMode(nextMode);
    } catch (error) {
      setModeError(
        error instanceof Error
          ? error.message
          : 'No se pudo cambiar el modo de uso.',
      );
    } finally {
      setIsChangingMode(false);
    }
  };

  if (isLoading || modeLoading || profile === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NotificationPermissionPrompt showToast={showToast} />
      <Text style={styles.brand}>Koma</Text>
      <Text style={styles.title}>
        Hola, {profile.display_name}
      </Text>

      {profile.is_artist ? (
        <View>
          <View style={styles.modeSwitcher}>
            <Text style={styles.modeLabel}>Usar Koma como:</Text>
            <View style={styles.modeOptions}>
              {(['artist', 'client'] as const).map((nextMode) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: mode === nextMode,
                    disabled: isChangingMode,
                  }}
                  disabled={isChangingMode}
                  key={nextMode}
                  onPress={() => void handleModeChange(nextMode)}
                  style={[
                    styles.modeOption,
                    mode === nextMode && styles.modeOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeOptionText,
                      mode === nextMode && styles.modeOptionTextSelected,
                    ]}
                  >
                    {nextMode === 'artist' ? 'Artista' : 'Cliente'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {modeError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {modeError}
            </Text>
          )}
          {mode === 'artist' ? (
            <View>
              <View style={styles.card}>
              <Text style={styles.cardTitle}>Tu perfil de artista</Text>
              <Text style={styles.handle}>@{profile.handle}</Text>
              <Text style={styles.cardText}>
                Tu perfil está activo y listo para ofrecer comisiones.
              </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/artist/commissions')}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Mis comisiones</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(app)/catalogo')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Gestionar catálogo</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(app)/catalogo/tos')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  Mis términos de servicio
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Modo cliente</Text>
                <Text style={styles.cardText}>
                  Explora artistas y solicita una comisión.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/commissions')}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Mis comisiones</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.options}>
          <Text style={styles.subtitle}>¿Qué quieres hacer?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/commissions')}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Mis comisiones</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/artist-setup')}
            style={[styles.secondaryButton, { marginTop: 12 }]}
          >
            <Text style={styles.secondaryButtonText}>
              Quiero ofrecer comisiones
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(app)/buscar')}
        style={styles.searchButton}
      >
        <Text style={styles.searchButtonText}>Buscar artista</Text>
      </Pressable>

      <NotificationSettingsRow showToast={showToast} />

      {logoutError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {logoutError}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={isSigningOut}
        onPress={() => void handleSignOut()}
        style={styles.logoutButton}
      >
        {isSigningOut ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  brand: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 18,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 28,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  handle: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 10,
  },
  modeSwitcher: {
    marginTop: 28,
  },
  modeLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  modeOptions: {
    flexDirection: 'row',
  },
  modeOption: {
    borderColor: colors.borderStrong,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 110,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeOptionText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  modeOptionTextSelected: {
    color: colors.surface,
    fontWeight: '700',
  },
  options: {
    marginTop: 32,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.primaryStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  searchButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: 18,
  },
  logoutButton: {
    alignItems: 'center',
    marginTop: 'auto',
    minHeight: 48,
    paddingVertical: 8,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
