import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  url: string | null | undefined;
  loading?: boolean;
}

/**
 * Preview del entregable final con lightbox al tocar (mismo patrón que AdvanceImageGrid).
 */
export function DeliverableImagePreview({ url, loading = false }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (loading) {
    return (
      <View style={styles.previewPlaceholder}>
        <ActivityIndicator size="small" color="#6B7280" />
      </View>
    );
  }

  if (!url) {
    return (
      <View style={styles.previewPlaceholder}>
        <Text style={styles.fallback}>Vista previa no disponible</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setLightboxOpen(true)} accessibilityRole="button">
        <Image
          source={{ uri: url }}
          style={styles.previewImage}
          contentFit="cover"
        />
      </Pressable>

      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setLightboxOpen(false)}>
          <Image
            source={{ uri: url }}
            style={styles.fullImage}
            contentFit="contain"
          />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fallback: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  fullImage: {
    height: '80%',
    width: '100%',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    flex: 1,
    justifyContent: 'center',
  },
  previewImage: {
    borderRadius: 10,
    height: 200,
    width: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    height: 200,
    justifyContent: 'center',
    width: '100%',
  },
});
