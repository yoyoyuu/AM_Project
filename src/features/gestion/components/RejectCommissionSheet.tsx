import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { rejectCommissionSchema, type RejectCommissionFormValues } from '../schemas';
import { colors } from '../../../theme';

interface Props {
  visible: boolean;
  onConfirm: (rejectionReason: string | null) => void;
  onCancel: () => void;
}

export function RejectCommissionSheet({ visible, onConfirm, onCancel }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectCommissionFormValues>({
    resolver: zodResolver(rejectCommissionSchema),
    defaultValues: { rejection_reason: '' },
  });

  const reason = useWatch({ control, name: 'rejection_reason' }) ?? '';
  const charCount = typeof reason === 'string' ? reason.length : 0;

  const onSubmit = (values: RejectCommissionFormValues) => {
    const trimmed = typeof values.rejection_reason === 'string'
      ? values.rejection_reason.trim()
      : '';
    reset();
    onConfirm(trimmed || null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Rechazar comisión</Text>
          <Text style={styles.subtitle}>
            Puedes indicar opcionalmente el motivo del rechazo.
          </Text>

          <Controller
            control={control}
            name="rejection_reason"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.rejection_reason && styles.inputError]}
                placeholder="Motivo de rechazo (opcional)"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={510}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value ?? ''}
                textAlignVertical="top"
              />
            )}
          />

          <View style={styles.counterRow}>
            {errors.rejection_reason && (
              <Text style={styles.errorText}>{errors.rejection_reason.message}</Text>
            )}
            <Text style={[styles.counter, charCount > 500 && styles.counterOver]}>
              {charCount} / 500
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={() => { void handleSubmit(onSubmit)(); }}>
              <Text style={styles.confirmLabel}>Confirmar rechazo</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  backdrop: {
    flex: 1,
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
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  counter: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 'auto',
  },
  counterOver: {
    color: colors.danger,
  },
  counterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: 12,
  },
  input: {
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    height: 100,
    marginTop: 12,
    padding: 10,
  },
  inputError: {
    borderColor: colors.danger,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
