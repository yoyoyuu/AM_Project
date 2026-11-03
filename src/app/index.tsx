import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import App from '../../App';
import { useAuth } from '../features/auth/AuthProvider';
import { useProfile } from '../features/auth/useProfile';

export default function IndexRoute() {
  const { loading: authLoading, session } = useAuth();
  const {
    error: profileError,
    isLoading: profileLoading,
    profile,
  } = useProfile();

  if (authLoading || (session !== null && profileLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#6C5CE7" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (profileError) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>
          No se pudo cargar tu perfil. Inténtalo de nuevo más tarde.
        </Text>
      </View>
    );
  }

  if (!profile?.profile_complete) {
    return <Redirect href="/(app)/profile-setup" />;
  }

  return <App />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 16,
    textAlign: 'center',
  },
});
