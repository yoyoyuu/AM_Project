import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { buildStepperConfig, formatRelativeDate } from '../presenters';
import { useCommissionTrackingDetail } from '../hooks/useCommissionTrackingDetail';
import { CommissionDetailSkeleton } from '../components/CommissionDetailSkeleton';
import { CommissionStatusBadge } from '../components/CommissionStatusBadge';
import { CreativeStepper } from '../components/CreativeStepper';
import { RejectionBlock } from '../components/RejectionBlock';
import type { CommissionReferenceView } from '../types';

interface Props {
  commissionId: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ReferenceGallery({ references }: { references: CommissionReferenceView[] }) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  if (references.length === 0) return null;

  return (
    <Block title="Referencias">
      <View style={styles.galleryGrid}>
        {references.map((ref) =>
          ref.signed_url ? (
            <Pressable key={ref.id} onPress={() => setSelectedUrl(ref.signed_url)}>
              <Image source={{ uri: ref.signed_url }} style={styles.thumbnail} />
            </Pressable>
          ) : null,
        )}
      </View>

      <Modal visible={selectedUrl !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedUrl(null)}>
          {selectedUrl !== null && (
            <Image
              source={{ uri: selectedUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </Block>
  );
}

export function CommissionTrackingDetailScreen({ commissionId }: Props) {
  const { data, isLoading, isError, refetch } = useCommissionTrackingDetail(commissionId);

  if (isLoading) {
    return (
      <ScrollView style={styles.container}>
        <CommissionDetailSkeleton />
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>
          No se pudo cargar el detalle. Comprueba tu conexión e intenta de nuevo
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          onPress={() => void refetch()}
          accessibilityRole="button"
        >
          <Text style={styles.retryLabel}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  const steps = buildStepperConfig(data.status, data.current_stage);
  const showStepper = data.status === 'EN_PROGRESO' || data.status === 'COMPLETADA';
  const showRejection = data.status === 'RECHAZADA';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Encabezado de estado */}
      <View style={styles.header}>
        <CommissionStatusBadge status={data.status} />
        {data.status === 'EN_PROGRESO' && data.current_stage !== null && (
          <Text style={styles.stageLabel}>
            Etapa actual: {steps.find((s) => s.state === 'active')?.label ?? ''}
          </Text>
        )}
      </View>

      {/* Stepper */}
      {showStepper && (
        <View style={styles.block}>
          <CreativeStepper steps={steps} />
        </View>
      )}

      {/* Bloque de rechazo */}
      {showRejection && (
        <View style={styles.blockPadding}>
          <RejectionBlock rejectionReason={data.rejection_reason} />
        </View>
      )}

      {/* Datos del servicio */}
      <Block title="Servicio contratado">
        <DetailRow label="Título" value={data.service_title} />
        <DetailRow label="Precio base" value={`$${data.service_base_price}`} />
        <DetailRow label="Tiempo estimado" value={`${data.service_estimated_days} días`} />
      </Block>

      {/* Datos del artista */}
      <Block title="Artista">
        <DetailRow label="Handle" value={`@${data.artist_handle}`} />
        {data.artist_display_name !== null && (
          <DetailRow label="Nombre" value={data.artist_display_name} />
        )}
      </Block>

      {/* Detalles del encargo */}
      <Block title="Tu encargo">
        <DetailRow label="Descripción" value={data.description} />
        <DetailRow
          label="Uso previsto"
          value={data.intended_use === 'personal' ? 'Personal' : 'Comercial'}
        />
        {data.pose !== null && <DetailRow label="Pose" value={data.pose} />}
        {data.key_elements !== null && (
          <DetailRow label="Elementos clave" value={data.key_elements} />
        )}
        {data.additional_notes !== null && (
          <DetailRow label="Notas adicionales" value={data.additional_notes} />
        )}
      </Block>

      {/* Galería de referencias */}
      <ReferenceGallery references={data.references} />

      {/* Fechas */}
      <Block title="Fechas">
        <DetailRow
          label="Solicitada el"
          value={new Date(data.created_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
        <DetailRow
          label="Última actualización"
          value={formatRelativeDate(data.updated_at)}
        />
      </Block>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  blockPadding: {
    marginBottom: 12,
  },
  blockTitle: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  centeredContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  container: {
    backgroundColor: '#F9FAFB',
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  detailLabel: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 2,
  },
  detailRow: {
    marginBottom: 8,
  },
  detailValue: {
    color: '#111827',
    fontSize: 15,
  },
  errorText: {
    color: '#374151',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  modalImage: {
    height: '80%',
    width: '100%',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    flex: 1,
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonPressed: {
    backgroundColor: '#374151',
  },
  retryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  stageLabel: {
    color: '#3B82F6',
    fontSize: 13,
    marginTop: 6,
  },
  thumbnail: {
    borderRadius: 8,
    height: 80,
    width: 80,
  },
});
