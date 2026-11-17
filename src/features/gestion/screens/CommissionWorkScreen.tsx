import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { CreativeStageIndicator } from '../components/CreativeStageIndicator';
import { useCommissionAction } from '../hooks/useCommissionAction';
import { useCommissionDetail } from '../hooks/useCommissionDetail';
import { getStageName } from '../stateMachine';
import { CREATIVE_STAGE_ORDER } from '../types';

const ERROR_GENERIC = 'No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo';

export function CommissionWorkScreen() {
  const { commissionId } = useLocalSearchParams<{ commissionId: string }>();
  const { user } = useAuth();

  const { data: commission, isPending, isError } = useCommissionDetail(commissionId ?? '');
  const { mutate: executeAction, isPending: isActing } = useCommissionAction();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Redirect to completed screen if commission is already COMPLETADA
  useEffect(() => {
    if (commission?.status === 'COMPLETADA') {
      router.replace({
        pathname: '/artist/commissions/[commissionId]/completed',
        params: { commissionId: commissionId ?? '' },
      });
    }
  }, [commission?.status, commissionId]);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C5CE7" size="large" />
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

  // Suppress UI while redirecting
  if (commission.status === 'COMPLETADA') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C5CE7" />
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
        onSuccess: ({ newStatus, newStage }) => {
          if (newStatus === 'COMPLETADA') {
            Alert.alert('¡Comisión completada! El cliente será notificado', undefined, [
              {
                text: 'OK',
                onPress: () =>
                  router.replace({
                    pathname: '/artist/commissions/[commissionId]/completed',
                    params: { commissionId: commission.id },
                  }),
              },
            ]);
          } else if (newStage !== null) {
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
          <Pressable
            style={[styles.advanceButton, isActing && styles.buttonDisabled]}
            disabled={isActing || currentStage === null}
            onPress={() => setShowConfirmDialog(true)}
          >
            <Text style={styles.advanceLabel}>
              {isLastStage ? 'Completar comisión' : 'Completar etapa'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmActionDialog
        visible={showConfirmDialog}
        title={isLastStage ? 'Completar comisión' : 'Completar etapa'}
        message={confirmMessage}
        confirmLabel="Confirmar"
        onConfirm={handleAdvanceConfirm}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    padding: 16,
    paddingBottom: 32,
  },
  advanceButton: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    paddingVertical: 14,
  },
  advanceLabel: {
    color: '#FFFFFF',
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
    color: '#374151',
    fontSize: 14,
    marginTop: 16,
  },
  divider: {
    backgroundColor: '#F3F4F6',
    height: 8,
  },
  errorText: {
    color: '#B91C1C',
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
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  serviceName: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  stageNameBold: {
    color: '#6C5CE7',
    fontWeight: '700',
  },
});
