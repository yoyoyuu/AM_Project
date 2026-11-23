import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

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
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
  },
  heading: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  reasonLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
