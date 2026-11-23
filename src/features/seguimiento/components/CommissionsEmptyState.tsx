import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';

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
    backgroundColor: colors.text,
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    backgroundColor: colors.text,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
