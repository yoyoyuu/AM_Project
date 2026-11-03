import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { signOut } from '../../features/auth/api';
import { useAppMode, type AppMode } from '../../features/auth/useAppMode';
import { useProfile } from '../../features/auth/useProfile';

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
        <ActivityIndicator color="#6C5CE7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tu perfil de artista</Text>
              <Text style={styles.handle}>@{profile.handle}</Text>
              <Text style={styles.cardText}>
                Tu perfil está activo y listo para ofrecer comisiones.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Modo cliente</Text>
              <Text style={styles.cardText}>
                Explora artistas y solicita una comisión.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.options}>
          <Text style={styles.subtitle}>¿Qué quieres hacer?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => undefined}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              Quiero pedir una comisión
            </Text>
            <Text style={styles.pendingText}>Próximamente</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/artist-setup')}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              Quiero ofrecer comisiones
            </Text>
          </Pressable>
        </View>
      )}

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
          <ActivityIndicator color="#B91C1C" />
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
    color: '#6C5CE7',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 28,
  },
  title: {
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 18,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 28,
    padding: 18,
  },
  cardTitle: {
    color: '#374151',
    fontSize: 17,
    fontWeight: '700',
  },
  handle: {
    color: '#6C5CE7',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
  },
  cardText: {
    color: '#6B7280',
    fontSize: 15,
    marginTop: 10,
  },
  modeSwitcher: {
    marginTop: 28,
  },
  modeLabel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  modeOptions: {
    flexDirection: 'row',
  },
  modeOption: {
    borderColor: '#D1D5DB',
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 110,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modeOptionSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  modeOptionText: {
    color: '#374151',
    fontSize: 15,
    textAlign: 'center',
  },
  modeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  options: {
    marginTop: 32,
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 12,
    padding: 16,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 5,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  error: {
    color: '#B91C1C',
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
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '600',
  },
});
