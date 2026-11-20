import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  Alert,
  ActivityIndicator,
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

import type { CommissionStatus, CreativeStage } from '../../gestion/types';
import { useUploadAdvance } from '../hooks/useUploadAdvance';
import { uploadAdvanceSchema, type UploadAdvanceFormValues } from '../schemas';
import type { CommissionAdvanceFile } from '../types';
import { pickAdvanceImages } from '../utils/pickAdvanceImages';
import { requestGalleryPermission } from '../utils/requestGalleryPermission';
import type { PickedImage } from '../utils/pickAdvanceImages';
import { AdvanceImageGrid } from './AdvanceImageGrid';

interface Props {
  visible: boolean;
  commissionId: string;
  artistId: string;
  currentStatus: CommissionStatus;
  currentStage: CreativeStage;
  onClose: () => void;
}

function toPreviewFiles(images: PickedImage[]): CommissionAdvanceFile[] {
  return images.map((img, index) => ({
    id: String(index),
    advance_id: '',
    storage_path: '',
    file_size: 0,
    sort_order: index,
    signed_url: img.uri,
  }));
}

export function UploadAdvanceSheet({
  visible,
  commissionId,
  artistId,
  currentStatus,
  currentStage,
  onClose,
}: Props) {
  const [selectedImages, setSelectedImages] = useState<PickedImage[] | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { mutateAsync: uploadAdvance, isPending } = useUploadAdvance();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UploadAdvanceFormValues>({
    resolver: zodResolver(uploadAdvanceSchema),
    defaultValues: { note: '' },
  });

  const noteValue = useWatch({ control, name: 'note' }) ?? '';
  const charCount = typeof noteValue === 'string' ? noteValue.length : 0;

  const handleClose = () => {
    setSelectedImages(null);
    setPermissionError(null);
    setUploadError(null);
    reset();
    onClose();
  };

  const handleSelectImages = async () => {
    setPermissionError(null);

    const permission = await requestGalleryPermission();
    if (!permission.granted) {
      setPermissionError(
        'No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo',
      );
      return;
    }

    const images = await pickAdvanceImages();
    if (images) {
      setSelectedImages(images);
      setUploadError(null);
    }
  };

  const onSubmit = async (values: UploadAdvanceFormValues) => {
    if (!selectedImages || selectedImages.length === 0) return;

    if (currentStatus !== 'EN_PROGRESO') {
      Alert.alert('No puedes subir avances en una comisión que no está en progreso');
      handleClose();
      return;
    }

    setUploadError(null);

    try {
      await uploadAdvance({
        commissionId,
        artistId,
        currentStatus,
        currentStage,
        images: selectedImages,
        note: typeof values.note === 'string' ? values.note : undefined,
      });
      Alert.alert('Avance subido correctamente');
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo';
      setUploadError(message);
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
          <Text style={styles.title}>Agregar avance</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
            {selectedImages ? (
              <>
                <AdvanceImageGrid files={toPreviewFiles(selectedImages)} />

                <Pressable style={styles.changeImagesButton} onPress={handleSelectImages}>
                  <Text style={styles.changeImagesLabel}>Cambiar imágenes</Text>
                </Pressable>

                <Controller
                  control={control}
                  name="note"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.note && styles.inputError]}
                      placeholder="Nota para el cliente (opcional)"
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
                  <Text style={[styles.counter, charCount > 300 && styles.counterOver]}>
                    {charCount} / 300
                  </Text>
                </View>
              </>
            ) : (
              <Pressable style={styles.selectButton} onPress={handleSelectImages}>
                <Text style={styles.selectLabel}>Seleccionar imágenes</Text>
              </Pressable>
            )}

            {permissionError && (
              <Text style={styles.errorBanner}>{permissionError}</Text>
            )}

            {uploadError && (
              <Text style={styles.errorBanner}>{uploadError}</Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose} disabled={isPending}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>

            {selectedImages && (
              <Pressable
                style={[styles.confirmButton, isPending && styles.confirmButtonDisabled]}
                onPress={() => { void handleSubmit(onSubmit)(); }}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmLabel}>Subir avance</Text>
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
  changeImagesButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  changeImagesLabel: {
    color: '#3B82F6',
    fontSize: 13,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 100,
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
    maxHeight: 420,
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
  input: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 14,
    height: 80,
    marginTop: 12,
    padding: 10,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
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
