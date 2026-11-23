import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useRequestPaymentCorrection } from '../hooks/useRequestPaymentCorrection';
import { CORRECTION_SUGGESTIONS } from '../presenters';
import { paymentCorrectionSchema, type PaymentCorrectionFormValues } from '../schemas';
import { colors } from '../../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  commissionId: string;
}

export function RequestCorrectionSheet({ visible, onClose, commissionId }: Props) {
  const { mutateAsync: requestCorrection, isPending } = useRequestPaymentCorrection();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentCorrectionFormValues>({
    resolver: zodResolver(paymentCorrectionSchema),
    defaultValues: { reason: '' },
  });

  const reasonValue = useWatch({ control, name: 'reason' }) ?? '';
  const charCount = typeof reasonValue === 'string' ? reasonValue.length : 0;

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: PaymentCorrectionFormValues) => {
    try {
      await requestCorrection({ commissionId, reason: values.reason });
      Alert.alert('Se pidió al cliente corregir su comprobante');
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo enviar la solicitud. Inténtalo de nuevo';
      Alert.alert('Error', message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>¿Qué debe corregir el cliente?</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
            <View style={styles.chips}>
              {CORRECTION_SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  style={[
                    styles.chip,
                    reasonValue === suggestion && styles.chipSelected,
                  ]}
                  onPress={() => setValue('reason', suggestion, { shouldValidate: true })}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      reasonValue === suggestion && styles.chipLabelSelected,
                    ]}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Controller
              control={control}
              name="reason"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.reason && styles.inputError]}
                  placeholder="O escribe el motivo..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={310}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value ?? ''}
                  textAlignVertical="top"
                />
              )}
            />

            <View style={styles.counterRow}>
              {errors.reason && (
                <Text style={styles.errorText}>{errors.reason.message}</Text>
              )}
              <Text style={[styles.counter, charCount > 300 && styles.counterOver]}>
                {charCount} / 300
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose} disabled={isPending}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, isPending && styles.confirmButtonDisabled]}
              onPress={() => { void handleSubmit(onSubmit)(); }}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={styles.confirmLabel}>Enviar al cliente</Text>
              )}
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
  chip: {
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 13,
  },
  chipLabelSelected: {
    color: colors.primaryStrong,
    fontWeight: '600',
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 120,
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
  content: {
    marginTop: 16,
    maxHeight: 360,
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
    height: 80,
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
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
