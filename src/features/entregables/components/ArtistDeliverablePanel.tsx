import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { pickSingleImage, isAllowedSource } from '../../../lib/media/pickSingleImage';
import type { PickedAsset } from '../../../lib/media/pickSingleImage';
import { requestGalleryPermission } from '../../avances/utils/requestGalleryPermission';
import type { CommissionPayment } from '../../pagos/types';
import { canArtistUploadDeliverable, formatFileSize } from '../presenters';
import { useSubmitDeliverable } from '../hooks/useSubmitDeliverable';
import { useDeliverablePreviewUrl } from '../hooks/useDeliverablePreviewUrl';
import { DeliverableImagePreview } from './DeliverableImagePreview';

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

export function ArtistDeliverablePanel({ payment }: Props) {
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutateAsync: submitDeliverable, isPending } = useSubmitDeliverable();

  const hasDeliverable = payment.deliverable_path !== null;
  const canUpload = canArtistUploadDeliverable(payment);
  const isCompleted = payment.status === 'COMPLETADA';

  const { data: previewUrl, isLoading: previewLoading } = useDeliverablePreviewUrl(
    payment.deliverable_path,
    hasDeliverable,
  );

  const handleSelectImage = async () => {
    setSourceError(null);

    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Acceso a la galería',
          'Koma necesita acceso a tu galería para que puedas seleccionar la ilustración final de la comisión.',
          [{ text: 'Continuar', onPress: () => resolve() }],
        );
      });

      const permission = await requestGalleryPermission();
      if (!permission.granted) {
        setSourceError(
          'No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo',
        );
        return;
      }
    }

    const asset = await pickSingleImage();
    if (!asset) return;

    if (!isAllowedSource(asset)) {
      setSourceError('Formato no permitido. Usa una imagen JPG, PNG o WEBP');
      return;
    }

    const confirmMsg = hasDeliverable
      ? '¿Reemplazar el entregable actual con esta imagen como entregable final? El cliente podrá ver la nueva versión.'
      : '¿Subir esta imagen como entregable final de la comisión?';

    Alert.alert('Confirmar entregable', confirmMsg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Subir', onPress: () => { void handleSubmit(asset); } },
    ]);
  };

  const handleSubmit = async (asset: PickedAsset) => {
    setSubmitError(null);
    try {
      const newStatus = await submitDeliverable({
        commissionId: payment.id,
        asset,
        previousPath: payment.deliverable_path,
      });
      if (newStatus === 'COMPLETADA') {
        Alert.alert('¡Comisión finalizada! El cliente ya puede descargar el entregable');
      } else {
        Alert.alert('Entregable subido. Se liberará al cliente cuando confirmes su pago');
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo subir el entregable. Comprueba tu conexión e inténtalo de nuevo';
      setSubmitError(message);
    }
  };

  if (!canUpload && !hasDeliverable) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entregable final</Text>

      {hasDeliverable && (
        <View style={styles.preview}>
          <DeliverableImagePreview url={previewUrl} loading={previewLoading} />

          <View style={styles.meta}>
            {payment.delivered_at ? (
              <Text style={styles.metaItem}>Subido el {formatDate(payment.delivered_at)}</Text>
            ) : null}
            {payment.deliverable_size !== null ? (
              <Text style={styles.metaItem}>{formatFileSize(payment.deliverable_size)}</Text>
            ) : null}
          </View>
        </View>
      )}

      {sourceError && <Text style={styles.errorBanner}>{sourceError}</Text>}
      {submitError && <Text style={styles.errorBanner}>{submitError}</Text>}

      {canUpload && !isCompleted && (
        <Pressable
          style={[styles.button, isPending && styles.buttonDisabled]}
          onPress={handleSelectImage}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonLabel}>
              {hasDeliverable ? 'Reemplazar entregable' : 'Subir entregable'}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    color: '#B91C1C',
    fontSize: 13,
    marginTop: 12,
    padding: 10,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  metaItem: {
    color: '#6B7280',
    fontSize: 12,
  },
  preview: {
    marginTop: 12,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
