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
                  placeholderTextColor="#9CA3AF"
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
                <ActivityIndicator size="small" color="#FFFFFF" />
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
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  chip: {
    borderColor: '#D1D5DB',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipLabel: {
    color: '#374151',
    fontSize: 13,
  },
  chipLabelSelected: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  chipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    marginTop: 16,
    maxHeight: 360,
  },
  counter: {
    color: '#6B7280',
    fontSize: 12,
    marginLeft: 'auto',
  },
  counterOver: {
    color: '#EF4444',
  },
  counterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  errorText: {
    color: '#EF4444',
    flex: 1,
    fontSize: 12,
  },
  input: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 14,
    height: 80,
    padding: 10,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
