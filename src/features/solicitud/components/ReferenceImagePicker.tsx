import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { requestGalleryPermission } from '../hooks/useGalleryPermission';
import type { LocalImageAsset } from '../types';
import { ReferenceImageThumbnail } from './ReferenceImageThumbnail';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'];

function inferMimeType(uri: string): string | null {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

interface Props {
  onImagesChange: (images: LocalImageAsset[]) => void;
}

export function ReferenceImagePicker({ onImagesChange }: Props) {
  const [images, setImages] = useState<LocalImageAsset[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const handleAdd = async () => {
    setErrorMessages([]);

    if (images.length >= MAX_IMAGES) {
      setErrorMessages(['Solo puedes adjuntar hasta 5 imágenes de referencia']);
      return;
    }

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled) return;

    const errors: string[] = [];
    const toAdd: LocalImageAsset[] = [];
    const remaining = MAX_IMAGES - images.length;

    for (const asset of result.assets) {
      const mimeType = asset.mimeType ?? inferMimeType(asset.uri);

      if (!mimeType || !ACCEPTED_MIME_TYPES.includes(mimeType)) {
        errors.push('Solo se aceptan imágenes en formato JPEG o PNG');
        continue;
      }

      const fileSize = asset.fileSize ?? 0;
      if (fileSize > MAX_FILE_SIZE) {
        errors.push('La imagen supera el tamaño máximo permitido de 10 MB');
        continue;
      }

      if (toAdd.length >= remaining) {
        errors.push('Solo puedes adjuntar hasta 5 imágenes de referencia');
        continue;
      }

      toAdd.push({
        uri: asset.uri,
        fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'image.jpg',
        fileSize,
        mimeType,
      });
    }

    const updated = [...images, ...toAdd];
    setImages(updated);
    onImagesChange(updated);

    // Deduplicate error messages for display
    setErrorMessages([...new Set(errors)]);
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    setImages(updated);
    onImagesChange(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Imágenes de referencia (opcional, máx. 5)</Text>

      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRow}
        >
          {images.map((img, index) => (
            <ReferenceImageThumbnail
              key={img.uri}
              uri={img.uri}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </ScrollView>
      )}

      {errorMessages.map((msg) => (
        <Text accessibilityRole="alert" key={msg} style={styles.error}>
          {msg}
        </Text>
      ))}

      <Pressable
        accessibilityRole="button"
        disabled={images.length >= MAX_IMAGES}
        onPress={() => void handleAdd()}
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.addButtonPressed,
          images.length >= MAX_IMAGES && styles.addButtonDisabled,
        ]}
      >
        <Text style={styles.addButtonText}>+ Agregar referencia</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  thumbnailRow: {
    gap: 10,
    paddingVertical: 4,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
  },
  addButton: {
    alignItems: 'center',
    borderColor: '#6C5CE7',
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 48,
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addButtonDisabled: {
    borderColor: '#D1D5DB',
  },
  addButtonText: {
    color: '#6C5CE7',
    fontSize: 15,
    fontWeight: '600',
  },
});
