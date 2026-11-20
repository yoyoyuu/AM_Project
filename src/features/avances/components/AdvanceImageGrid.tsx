import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

import type { CommissionAdvanceFile } from '../types';

interface Props {
  files: CommissionAdvanceFile[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 4;

export function AdvanceImageGrid({ files }: Props) {
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const count = files.length;

  const thumbSize =
    count === 1
      ? SCREEN_WIDTH - 32
      : count === 2
        ? (SCREEN_WIDTH - 32 - GAP) / 2
        : (SCREEN_WIDTH - 32 - GAP * 2) / 3;

  return (
    <>
      <View style={[styles.grid, count === 1 && styles.gridCenter]}>
        {files.map((file) =>
          file.signed_url ? (
            <Pressable
              key={file.id}
              onPress={() => setLightboxUri(file.signed_url)}
              style={{ width: thumbSize, height: thumbSize }}
            >
              <Image
                source={{ uri: file.signed_url }}
                style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
                contentFit="cover"
              />
            </Pressable>
          ) : (
            <View
              key={file.id}
              style={[styles.thumb, styles.thumbError, { width: thumbSize, height: thumbSize }]}
            />
          ),
        )}
      </View>

      <Modal
        visible={lightboxUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUri(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setLightboxUri(null)}>
          <Image
            source={lightboxUri ? { uri: lightboxUri } : null}
            style={styles.fullImage}
            contentFit="contain"
          />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  gridCenter: {
    justifyContent: 'center',
  },
  thumb: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  thumbError: {
    backgroundColor: '#FEE2E2',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    flex: 1,
    justifyContent: 'center',
  },
  fullImage: {
    height: '80%',
    width: '100%',
  },
});
