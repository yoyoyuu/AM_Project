import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

export interface CommissionSuccessScreenProps {
  artistHandle: string;
}

export function CommissionSuccessScreen({ artistHandle: _artistHandle }: CommissionSuccessScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.title}>¡Solicitud enviada!</Text>
        <Text style={styles.message}>
          Tu solicitud fue enviada. El artista la revisará pronto.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Volver al perfil del artista</Text>
      </Pressable>
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
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  icon: {
    backgroundColor: colors.primary,
    borderRadius: 40,
    color: colors.surface,
    fontSize: 32,
    height: 80,
    lineHeight: 80,
    textAlign: 'center',
    width: 80,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
