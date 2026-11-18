import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  onExploreArtists: () => void;
}

export function CommissionsEmptyState({ onExploreArtists }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>Aún no has solicitado ninguna comisión</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onExploreArtists}
        accessibilityRole="button"
        accessibilityLabel="Explorar artistas"
      >
        <Text style={styles.buttonLabel}>Explorar artistas</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#111827',
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    backgroundColor: '#374151',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  message: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
  },
});
