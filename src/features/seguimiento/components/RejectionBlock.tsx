import { StyleSheet, Text, View } from 'react-native';

interface Props {
  rejectionReason: string | null;
}

export function RejectionBlock({ rejectionReason }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Solicitud rechazada</Text>
      {rejectionReason !== null ? (
        <>
          <Text style={styles.reasonLabel}>Motivo indicado por el artista:</Text>
          <Text style={styles.reasonText}>{rejectionReason}</Text>
        </>
      ) : (
        <Text style={styles.reasonText}>El artista no indicó un motivo específico.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
  },
  heading: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  reasonLabel: {
    color: '#7F1D1D',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
});
