import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { canArtistReviewPayment, ARTIST_PAYMENT_MESSAGES } from '../presenters';
import type { CommissionPayment } from '../types';
import { useVerifyPayment } from '../hooks/useVerifyPayment';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { PaymentProofViewer } from './PaymentProofViewer';
import { ConfirmPaymentDialog } from './ConfirmPaymentDialog';
import { RequestCorrectionSheet } from './RequestCorrectionSheet';
import { colors } from '../../../theme';

interface Props {
  payment: CommissionPayment;
}

export function ArtistPaymentPanel({ payment }: Props) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [correctionVisible, setCorrectionVisible] = useState(false);

  const { mutateAsync: verifyPayment, isPending: isVerifying } = useVerifyPayment();
  const canReview = canArtistReviewPayment(payment);

  const handleConfirm = async () => {
    try {
      const newStatus = await verifyPayment(payment.id);
      setConfirmVisible(false);
      if (newStatus === 'COMPLETADA') {
        Alert.alert(
          'Pago confirmado. ¡Comisión finalizada! El cliente ya puede descargar el entregable',
        );
      } else {
        Alert.alert('Pago confirmado');
      }
    } catch (err) {
      setConfirmVisible(false);
      const message =
        err instanceof Error ? err.message : 'No se pudo confirmar el pago. Inténtalo de nuevo';
      Alert.alert('Error', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pago y entrega</Text>

      <View style={styles.statusRow}>
        <PaymentStatusBadge status={payment.payment_status} />
      </View>

      <Text style={styles.message}>{ARTIST_PAYMENT_MESSAGES[payment.payment_status]}</Text>

      {payment.payment_proof_path && (
        <Pressable style={styles.proofButton} onPress={() => setViewerVisible(true)}>
          <Text style={styles.proofButtonLabel}>Ver comprobante</Text>
        </Pressable>
      )}

      {canReview && (
        <View style={styles.actions}>
          <Pressable
            style={styles.correctionButton}
            onPress={() => setCorrectionVisible(true)}
          >
            <Text style={styles.correctionLabel}>Requiere corrección</Text>
          </Pressable>
          <Pressable
            style={styles.confirmButton}
            onPress={() => setConfirmVisible(true)}
          >
            <Text style={styles.confirmLabel}>Confirmar pago</Text>
          </Pressable>
        </View>
      )}

      <PaymentProofViewer
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        path={payment.payment_proof_path}
        reference={payment.payment_reference}
        note={payment.payment_note}
        uploadedAt={payment.payment_proof_uploaded_at}
      />

      <ConfirmPaymentDialog
        visible={confirmVisible}
        isPending={isVerifying}
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setConfirmVisible(false)}
      />

      <RequestCorrectionSheet
        visible={correctionVisible}
        onClose={() => setCorrectionVisible(false)}
        commissionId={payment.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  confirmLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  correctionButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  correctionLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  proofButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  proofButtonLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  statusRow: {
    marginTop: 10,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
