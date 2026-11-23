import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

export function DeliverableLockedCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>🔒</Text>
      <View style={styles.textBox}>
        <Text style={styles.title}>Entregable listo</Text>
        <Text style={styles.body}>
          Completa o verifica tu pago para desbloquearlo
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  icon: {
    fontSize: 24,
  },
  textBox: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
