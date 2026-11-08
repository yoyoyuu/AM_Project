import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    color: '#6C5CE7',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 16,
  },
  tagline: {
    color: '#6B7280',
    fontSize: 18,
    lineHeight: 26,
  },
  actions: {
    gap: 12,
  },
  buttonPrimary: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonSecondary: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#6C5CE7',
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '700',
  },
});
