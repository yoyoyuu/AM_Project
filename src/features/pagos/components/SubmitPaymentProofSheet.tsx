import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

import { pickSingleImage, isAllowedSource } from '../../../lib/media/pickSingleImage';
import type { PickedAsset } from '../../../lib/media/pickSingleImage';
import { requestGalleryPermission } from '../../avances/utils/requestGalleryPermission';
import { useSubmitPaymentProof } from '../hooks/useSubmitPaymentProof';
import { paymentProofSchema, type PaymentProofFormValues } from '../schemas';

interface Props {
  visible: boolean;
  onClose: () => void;
  commissionId: string;
}

const PREVIEW_SIZE = Dimensions.get('window').width - 40;

export function SubmitPaymentProofSheet({ visible, onClose, commissionId }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<PickedAsset | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutateAsync: submitProof, isPending } = useSubmitPaymentProof();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentProofFormValues>({
    resolver: zodResolver(paymentProofSchema),
    defaultValues: { reference: '', note: '' },
  });

  const refValue = useWatch({ control, name: 'reference' }) ?? '';
  const noteValue = useWatch({ control, name: 'note' }) ?? '';
  const refCount = typeof refValue === 'string' ? refValue.length : 0;
  const noteCount = typeof noteValue === 'string' ? noteValue.length : 0;

  const handleClose = () => {
    setSelectedAsset(null);
    setPermissionError(null);
    setSourceError(null);
    setSubmitError(null);
    reset();
    onClose();
  };

  const handleSelectImage = async () => {
    setPermissionError(null);
    setSourceError(null);

    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Acceso a la galería',
          'Koma necesita acceso a tu galería para que puedas seleccionar la captura o foto de tu comprobante de pago.',
          [{ text: 'Continuar', onPress: () => resolve() }],
        );
      });

      const permission = await requestGalleryPermission();
      if (!permission.granted) {
        setPermissionError(
          'No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo',
        );
        return;
      }
    }

    const asset = await pickSingleImage();
    if (!asset) return;

    if (!isAllowedSource(asset)) {
      setSourceError('Formato o tamaño no permitido');
      return;
    }

    setSelectedAsset(asset);
  };

  const onSubmit = async (values: PaymentProofFormValues) => {
    if (!selectedAsset) return;
    setSubmitError(null);

    try {
      await submitProof({
        commissionId,
        asset: selectedAsset,
        reference: typeof values.reference === 'string' ? values.reference : undefined,
        note: typeof values.note === 'string' ? values.note : undefined,
      });
      Alert.alert('Comprobante enviado. El artista lo revisará pronto');
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo enviar el comprobante. Comprueba tu conexión e inténtalo de nuevo';
      setSubmitError(message);
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
          <Text style={styles.title}>Enviar comprobante de pago</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
            {selectedAsset ? (
              <>
                <Image
                  source={{ uri: selectedAsset.uri }}
                  style={[styles.preview, { height: PREVIEW_SIZE }]}
                  contentFit="cover"
                />

                <Pressable style={styles.changeButton} onPress={handleSelectImage}>
                  <Text style={styles.changeLabel}>Cambiar imagen</Text>
                </Pressable>

                <Text style={styles.fieldLabel}>Referencia o folio (opcional)</Text>
                <Controller
                  control={control}
                  name="reference"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.reference && styles.inputError]}
                      placeholder="Ej. 123456789"
                      placeholderTextColor="#9CA3AF"
                      maxLength={70}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value ?? ''}
                    />
                  )}
                />
                <View style={styles.counterRow}>
                  {errors.reference && (
                    <Text style={styles.errorText}>{errors.reference.message}</Text>
                  )}
                  <Text style={[styles.counter, refCount > 60 && styles.counterOver]}>
                    {refCount} / 60
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Nota para el artista (opcional)</Text>
                <Controller
                  control={control}
                  name="note"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, styles.inputMultiline, errors.note && styles.inputError]}
                      placeholder="Algún comentario adicional..."
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
                  {errors.note && (
                    <Text style={styles.errorText}>{errors.note.message}</Text>
                  )}
                  <Text style={[styles.counter, noteCount > 300 && styles.counterOver]}>
                    {noteCount} / 300
                  </Text>
                </View>
              </>
            ) : (
              <Pressable style={styles.selectButton} onPress={handleSelectImage}>
                <Text style={styles.selectLabel}>Seleccionar imagen</Text>
              </Pressable>
            )}

            {permissionError && (
              <Text style={styles.errorBanner}>{permissionError}</Text>
            )}
            {sourceError && (
              <Text style={styles.errorBanner}>{sourceError}</Text>
            )}
            {submitError && (
              <Text style={styles.errorBanner}>{submitError}</Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose} disabled={isPending}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>

            {selectedAsset && (
              <Pressable
                style={[styles.confirmButton, isPending && styles.confirmButtonDisabled]}
                onPress={() => { void handleSubmit(onSubmit)(); }}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmLabel}>Enviar comprobante</Text>
                )}
              </Pressable>
            )}
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
  changeButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  changeLabel: {
    color: '#3B82F6',
    fontSize: 13,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#3B82F6',
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
    maxHeight: 480,
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
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    color: '#B91C1C',
    fontSize: 13,
    marginTop: 12,
    padding: 10,
  },
  errorText: {
    color: '#EF4444',
    flex: 1,
    fontSize: 12,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 14,
  },
  input: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 14,
    marginTop: 4,
    padding: 10,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  preview: {
    borderRadius: 10,
    width: '100%',
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 40,
  },
  selectLabel: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
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
