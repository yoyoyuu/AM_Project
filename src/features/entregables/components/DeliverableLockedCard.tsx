import { StyleSheet, Text, View } from 'react-native';

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
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
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
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
