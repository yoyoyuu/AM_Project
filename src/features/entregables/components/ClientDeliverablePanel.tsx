import { StyleSheet, Text, View } from 'react-native';

import type { CommissionPayment } from '../../pagos/types';
import { formatFileSize, getClientDeliverableView } from '../presenters';
import { useDeliverablePreviewUrl } from '../hooks/useDeliverablePreviewUrl';
import { DeliverableImagePreview } from './DeliverableImagePreview';
import { DeliverableLockedCard } from './DeliverableLockedCard';
import { SaveToGalleryButton } from './SaveToGalleryButton';

interface Props {
  payment: CommissionPayment;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function UnlockedDeliverable({ payment }: { payment: CommissionPayment }) {
  const { data: url, isLoading } = useDeliverablePreviewUrl(
    payment.deliverable_path,
    true,
  );

  return (
    <View style={styles.unlockedContainer}>
      <DeliverableImagePreview url={url} loading={isLoading} />

      <Text style={styles.unlockedTitle}>Tu entregable está listo</Text>

      <View style={styles.meta}>
        {payment.delivered_at ? (
          <Text style={styles.metaItem}>Subido el {formatDate(payment.delivered_at)}</Text>
        ) : null}
        {payment.deliverable_size !== null ? (
          <Text style={styles.metaItem}>{formatFileSize(payment.deliverable_size)}</Text>
        ) : null}
      </View>

      <SaveToGalleryButton
        commissionId={payment.id}
        deliverablePath={payment.deliverable_path as string}
      />
    </View>
  );
}

export function ClientDeliverablePanel({ payment }: Props) {
  const view = getClientDeliverableView(payment);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entregable final</Text>

      <View style={styles.content}>
        {view === 'NOT_UPLOADED' && (
          <Text style={styles.notUploadedTxt}>
            El artista aún no ha subido el entregable final
          </Text>
        )}
        {view === 'LOCKED' && <DeliverableLockedCard />}
        {view === 'UNLOCKED' && <UnlockedDeliverable payment={payment} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  content: {
    marginTop: 12,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
    marginTop: 8,
  },
  metaItem: {
    color: '#6B7280',
    fontSize: 12,
  },
  notUploadedTxt: {
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  unlockedContainer: {
    gap: 0,
  },
  unlockedTitle: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});
