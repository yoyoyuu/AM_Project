import { StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  base_price: number;
  estimated_days: number;
}

export function ServiceSummaryCard({ title, base_price, estimated_days }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.details}>
        {`Precio base: $${base_price} MXN · Tiempo estimado: ${estimated_days} día${estimated_days === 1 ? '' : 's'}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F3F0FF',
    borderColor: '#DDD6FE',
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  title: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  details: {
    color: '#374151',
    fontSize: 14,
  },
});
