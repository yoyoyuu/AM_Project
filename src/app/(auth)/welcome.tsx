import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.tagline}>
          El lugar donde los artistas y sus clientes se encuentran.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonPrimaryText}>Iniciar sesión</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/register')}
          style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonSecondaryText}>Crear cuenta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 48,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  brand: {
    color: colors.primary,
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 16,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 18,
    lineHeight: 26,
  },
  actions: {
    gap: 12,
  },
  buttonPrimary: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonSecondary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonPrimaryText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
