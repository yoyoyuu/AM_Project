import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

interface Props {
  visible: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPaymentDialog({ visible, isPending, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Confirmar pago recibido</Text>
          <Text style={styles.message}>
            ¿Confirmas que recibiste el pago completo de esta comisión? Esta acción no se puede
            deshacer.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel} disabled={isPending}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, isPending && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={styles.confirmLabel}>Confirmar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelButton: {
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 90,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginHorizontal: 24,
    padding: 20,
    width: '100%',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
