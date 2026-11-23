import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

interface Props {
  uri: string;
  onRemove: () => void;
}

export function ReferenceImageThumbnail({ uri, onRemove }: Props) {
  return (
    <View style={styles.container}>
      <Image
        accessibilityLabel="Imagen de referencia"
        source={{ uri }}
        style={styles.image}
      />
      <Pressable
        accessibilityLabel="Eliminar imagen"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onRemove}
        style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
      >
        <Text style={styles.removeIcon}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    width: 80,
  },
  image: {
    borderRadius: 8,
    height: 80,
    width: 80,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
  },
  removeButtonPressed: {
    opacity: 0.7,
  },
  removeIcon: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
});
