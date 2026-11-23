import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { CommissionStatusBadge } from '../components/CommissionStatusBadge';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { ReferenceGallery } from '../components/ReferenceGallery';
import { RejectCommissionSheet } from '../components/RejectCommissionSheet';
import { useCommissionAction } from '../hooks/useCommissionAction';
import { useCommissionDetail } from '../hooks/useCommissionDetail';
import { colors } from '../../../theme';

const ERROR_GENERIC = 'No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo';
const ERROR_PERMISSION = 'No tienes permiso para ver esta comisión';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function CommissionDetailScreen() {
  const { commissionId } = useLocalSearchParams<{ commissionId: string }>();
  const { user } = useAuth();

  const { data: commission, isPending, isError } = useCommissionDetail(commissionId ?? '');
  const { mutate: executeAction, isPending: isActing } = useCommissionAction();

  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectSheet, setShowRejectSheet] = useState(false);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !commission) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {ERROR_GENERIC}
        </Text>
      </View>
    );
  }

  if (commission.artist_id !== user?.id) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {ERROR_PERMISSION}
        </Text>
      </View>
    );
  }

  const isPending_ = commission.status === 'PENDIENTE';

  const handleAcceptConfirm = () => {
    setShowAcceptDialog(false);
    executeAction(
      {
        commissionId: commission.id,
        artistId: user.id,
        currentStatus: commission.status,
        currentStage: commission.current_stage,
        action: 'ACCEPT',
      },
      {
        onSuccess: () => {
          Alert.alert('Comisión aceptada. ¡A trabajar!', undefined, [
            {
              text: 'OK',
              onPress: () =>
                router.replace({
                  pathname: '/artist/commissions/[commissionId]/work',
                  params: { commissionId: commission.id },
                }),
            },
          ]);
        },
        onError: (err) => {
          Alert.alert('Error', err instanceof Error ? err.message : ERROR_GENERIC);
        },
      },
    );
  };

  const handleRejectConfirm = (rejectionReason: string | null) => {
    setShowRejectSheet(false);
    executeAction(
      {
        commissionId: commission.id,
        artistId: user.id,
        currentStatus: commission.status,
        currentStage: commission.current_stage,
        action: 'REJECT',
        rejectionReason: rejectionReason ?? undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Comisión rechazada', undefined, [
            {
              text: 'OK',
              onPress: () =>
                router.replace({
                  pathname: '/artist/commissions',
                  params: {},
                }),
            },
          ]);
        },
        onError: (err) => {
          Alert.alert('Error', err instanceof Error ? err.message : ERROR_GENERIC);
        },
      },
    );
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Service summary */}
        <View style={styles.section}>
          <Text style={styles.serviceName}>{commission.service.title}</Text>
          <View style={styles.row}>
            <CommissionStatusBadge status={commission.status} />
          </View>
          <View style={styles.serviceMetaRow}>
            <Text style={styles.serviceMeta}>
              ${commission.service.price_mxn} MXN
            </Text>
            <Text style={styles.serviceMeta}>
              {commission.service.delivery_days}{' '}
              {commission.service.delivery_days === 1 ? 'día' : 'días'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          {commission.client_profile?.handle ? (
            <>
              <DetailRow label="Handle" value={`@${commission.client_profile.handle}`} />
              {commission.client_profile.display_name && (
                <DetailRow label="Nombre" value={commission.client_profile.display_name} />
              )}
            </>
          ) : commission.client_profile?.display_name ? (
            <DetailRow label="Nombre" value={commission.client_profile.display_name} />
          ) : (
            <DetailRow label="Cliente" value="Sin handle" />
          )}
        </View>

        <View style={styles.divider} />

        {/* Request details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles de la solicitud</Text>
          <DetailRow label="Descripción" value={commission.description} />
          <DetailRow
            label="Uso previsto"
            value={commission.intended_use === 'personal' ? 'Personal' : 'Comercial'}
          />
          {commission.pose && <DetailRow label="Pose" value={commission.pose} />}
          {commission.key_elements && (
            <DetailRow label="Elementos clave" value={commission.key_elements} />
          )}
          {commission.additional_notes && (
            <DetailRow label="Notas adicionales" value={commission.additional_notes} />
          )}
        </View>

        <View style={styles.divider} />

        {/* Reference gallery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imágenes de referencia</Text>
          <ReferenceGallery references={commission.references} />
        </View>

        {/* Action buttons — only when PENDIENTE */}
        {isPending_ && (
          <>
            <View style={styles.divider} />
            <View style={styles.actions}>
              <Pressable
                style={[styles.acceptButton, isActing && styles.buttonDisabled]}
                disabled={isActing}
                onPress={() => setShowAcceptDialog(true)}
              >
                <Text style={styles.acceptLabel}>Aceptar comisión</Text>
              </Pressable>
              <Pressable
                style={[styles.rejectButton, isActing && styles.buttonDisabled]}
                disabled={isActing}
                onPress={() => setShowRejectSheet(true)}
              >
                <Text style={styles.rejectLabel}>Rechazar comisión</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmActionDialog
        visible={showAcceptDialog}
        title="Aceptar comisión"
        message="¿Confirmas que deseas aceptar esta comisión?"
        confirmLabel="Aceptar"
        onConfirm={handleAcceptConfirm}
        onCancel={() => setShowAcceptDialog(false)}
      />

      <RejectCommissionSheet
        visible={showRejectSheet}
        onConfirm={handleRejectConfirm}
        onCancel={() => setShowRejectSheet(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  acceptButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginBottom: 10,
    paddingVertical: 14,
  },
  acceptLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    padding: 16,
    paddingBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    backgroundColor: colors.surfaceSunken,
    height: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  rejectButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  rejectLabel: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  serviceMeta: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  serviceMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  serviceName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
});
