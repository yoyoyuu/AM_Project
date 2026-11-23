import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommissionStatusBadge } from '../components/CommissionStatusBadge';
import { colors } from '../../../theme';

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
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
  },
  buttonLabel: {
    color: colors.surface,
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
    color: colors.surface,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    marginBottom: 24,
    width: 96,
  },
  message: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 16,
    textAlign: 'center',
  },
});
