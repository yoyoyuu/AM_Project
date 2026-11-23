import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { canClientSubmitProof, CLIENT_PAYMENT_MESSAGES } from '../presenters';
import type { CommissionPayment } from '../types';
import { usePaymentProofUrl } from '../hooks/usePaymentProofUrl';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { SubmitPaymentProofSheet } from './SubmitPaymentProofSheet';
import { colors } from '../../../theme';

interface Props {
  payment: CommissionPayment;
}

function ProofThumbnail({ path }: { path: string }) {
  const { data: url, isLoading } = usePaymentProofUrl(path);
  if (isLoading) return <ActivityIndicator size="small" color={colors.textSecondary} style={styles.thumbLoader} />;
  if (!url) return null;
  return (
    <Image
      source={{ uri: url }}
      style={styles.thumbnail}
      contentFit="cover"
    />
  );
}

export function ClientPaymentPanel({ payment }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const isPending = payment.status === 'PENDIENTE';
  const canSubmit = canClientSubmitProof(payment);

  const buttonLabel =
    payment.payment_status === 'NEEDS_CORRECTION'
      ? 'Enviar nuevo comprobante'
      : 'Subir comprobante';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pago y entrega</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTxt}>
          Koma no procesa pagos directamente. Realiza la transferencia por tu cuenta y sube aquí la captura o foto de tu comprobante para que el artista la verifique.
        </Text>
      </View>

      <Text style={styles.amount}>
        Monto de referencia:{' '}
        <Text style={styles.amountValue}>
          ${payment.base_price.toLocaleString('es-MX')} MXN
        </Text>
      </Text>

      <View style={styles.statusRow}>
        <PaymentStatusBadge status={payment.payment_status} />
      </View>

      <Text style={styles.message}>
        {CLIENT_PAYMENT_MESSAGES[payment.payment_status]}
      </Text>

      {payment.payment_status === 'NEEDS_CORRECTION' && (
        <View style={styles.correctionBox}>
          {payment.payment_correction_reason ? (
            <Text style={styles.correctionReason}>
              Motivo: {payment.payment_correction_reason}
            </Text>
          ) : null}
          {payment.payment_proof_path ? (
            <ProofThumbnail path={payment.payment_proof_path} />
          ) : null}
        </View>
      )}

      {isPending ? (
        <Text style={styles.pendingNote}>
          Podrás subir tu comprobante cuando el artista acepte la comisión
        </Text>
      ) : canSubmit ? (
        <Pressable style={styles.button} onPress={() => setSheetVisible(true)}>
          <Text style={styles.buttonLabel}>{buttonLabel}</Text>
        </Pressable>
      ) : null}

      <SubmitPaymentProofSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        commissionId={payment.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    color: colors.text,
    fontSize: 14,
    marginTop: 12,
  },
  amountValue: {
    color: colors.text,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  correctionBox: {
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  correctionReason: {
    color: colors.danger,
    fontSize: 13,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  notice: {
    backgroundColor: colors.background,
    borderRadius: 8,
    marginTop: 10,
    padding: 10,
  },
  noticeTxt: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  pendingNote: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 14,
  },
  statusRow: {
    marginTop: 12,
  },
  thumbnail: {
    borderRadius: 6,
    height: 80,
    width: 80,
  },
  thumbLoader: {
    height: 80,
    width: 80,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
