import { useLocalSearchParams } from 'expo-router';
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
import { AdvancesList } from '../../avances/components/AdvancesList';
import { UploadAdvanceSheet } from '../../avances/components/UploadAdvanceSheet';
import { ArtistDeliverablePanel } from '../../entregables/components/ArtistDeliverablePanel';
import { ArtistPaymentPanel } from '../../pagos/components/ArtistPaymentPanel';
import { useCommissionPayment } from '../../pagos/hooks/useCommissionPayment';
import { CommissionStatusBadge } from '../components/CommissionStatusBadge';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { CreativeStageIndicator } from '../components/CreativeStageIndicator';
import { useCommissionAction } from '../hooks/useCommissionAction';
import { useCommissionDetail } from '../hooks/useCommissionDetail';
import { getStageName } from '../stateMachine';
import { CREATIVE_STAGE_ORDER } from '../types';
import { colors } from '../../../theme';

const ERROR_GENERIC = 'No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo';

export function CommissionWorkScreen() {
  const { commissionId } = useLocalSearchParams<{ commissionId: string }>();
  const { user } = useAuth();

  const { data: commission, isPending, isError } = useCommissionDetail(commissionId ?? '');
  const { data: payment } = useCommissionPayment(commissionId ?? '');
  const { mutate: executeAction, isPending: isActing } = useCommissionAction();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);

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

  const currentStage = commission.current_stage;
  const isLastStage =
    currentStage !== null &&
    CREATIVE_STAGE_ORDER.indexOf(currentStage) === CREATIVE_STAGE_ORDER.length - 1;

  const confirmMessage = isLastStage
    ? '¿Confirmas que el encargo está terminado y listo para entrega?'
    : currentStage !== null
      ? `¿Confirmas que completaste la etapa ${getStageName(currentStage)}?`
      : '¿Confirmas que deseas avanzar la etapa?';

  const handleAdvanceConfirm = () => {
    setShowConfirmDialog(false);
    executeAction(
      {
        commissionId: commission.id,
        artistId: user?.id ?? '',
        currentStatus: commission.status,
        currentStage: commission.current_stage,
        action: 'ADVANCE_STAGE',
      },
      {
        onSuccess: ({ newStage }) => {
          if (newStage !== null) {
            Alert.alert(`Etapa completada. Ahora estás en: ${getStageName(newStage)}`);
          }
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
        <View style={styles.headerSection}>
          <Text style={styles.serviceName}>{commission.service.title}</Text>
          <View style={styles.badgeRow}>
            <CommissionStatusBadge status={commission.status} />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progreso del trabajo</Text>
          <CreativeStageIndicator currentStage={commission.current_stage} />
          {currentStage !== null && (
            <Text style={styles.currentStageName}>
              Etapa actual: <Text style={styles.stageNameBold}>{getStageName(currentStage)}</Text>
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.actions}>
          {commission.status === 'EN_PROGRESO' && currentStage !== null && (
            <Pressable
              style={styles.uploadButton}
              onPress={() => setShowUploadSheet(true)}
            >
              <Text style={styles.uploadLabel}>Agregar avance</Text>
            </Pressable>
          )}
          {!isLastStage && (
            <Pressable
              style={[styles.advanceButton, isActing && styles.buttonDisabled]}
              disabled={isActing || currentStage === null}
              onPress={() => setShowConfirmDialog(true)}
            >
              <Text style={styles.advanceLabel}>Completar etapa</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avances</Text>
          <AdvancesList commissionId={commission.id} role="artist" />
        </View>

        {(commission.status === 'EN_PROGRESO' || commission.status === 'COMPLETADA') && payment && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <ArtistPaymentPanel payment={payment} />
            </View>
            <View style={styles.divider} />
            <View style={styles.section}>
              <ArtistDeliverablePanel payment={payment} />
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmActionDialog
        visible={showConfirmDialog}
        title={isLastStage ? 'Completar comisión' : 'Completar etapa'}
        message={confirmMessage}
        confirmLabel="Confirmar"
        onConfirm={handleAdvanceConfirm}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {commission.status === 'EN_PROGRESO' && currentStage !== null && (
        <UploadAdvanceSheet
          visible={showUploadSheet}
          commissionId={commission.id}
          artistId={user?.id ?? ''}
          currentStatus={commission.status}
          currentStage={currentStage}
          onClose={() => setShowUploadSheet(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
    padding: 16,
    paddingBottom: 32,
  },
  uploadButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 12,
  },
  uploadLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  advanceButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  advanceLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  badgeRow: {
    alignItems: 'flex-start',
    marginTop: 8,
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
  currentStageName: {
    color: colors.text,
    fontSize: 14,
    marginTop: 16,
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
  headerSection: {
    padding: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  serviceName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  stageNameBold: {
    color: colors.primary,
    fontWeight: '700',
  },
});
