import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CommissionReference } from '../types';
import { colors } from '../../../theme';

interface Props {
  references: CommissionReference[];
}

const THUMBNAIL_SIZE = (Dimensions.get('window').width - 48) / 3;

export function ReferenceGallery({ references }: Props) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const viewable = references.filter((r) => r.signed_url !== null);

  if (viewable.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin imágenes de referencia</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={viewable}
        keyExtractor={(item) => item.id}
        numColumns={3}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedUrl(item.signed_url)}>
            <Image
              source={{ uri: item.signed_url! }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </Pressable>
        )}
        contentContainerStyle={styles.grid}
      />

      <Modal
        visible={selectedUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUrl(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedUrl(null)}>
          {selectedUrl !== null && (
            <Image
              source={{ uri: selectedUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  fullImage: {
    height: '90%',
    width: '100%',
  },
  grid: {
    gap: 4,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    flex: 1,
    justifyContent: 'center',
  },
  thumbnail: {
    borderRadius: 6,
    height: THUMBNAIL_SIZE,
    margin: 2,
    width: THUMBNAIL_SIZE,
  },
});
