import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommissionStatusBadge } from '../components/CommissionStatusBadge';

export function CommissionCompletedScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>✓</Text>
      </View>

      <Text style={styles.message}>¡Comisión completada! El cliente será notificado</Text>

      <CommissionStatusBadge status="COMPLETADA" />

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => router.replace('/artist/commissions')}
        accessibilityRole="button"
      >
        <Text style={styles.buttonLabel}>Volver al panel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    marginBottom: 24,
    width: 96,
  },
  message: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 16,
    textAlign: 'center',
  },
});
