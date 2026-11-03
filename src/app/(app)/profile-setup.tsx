import { StyleSheet, Text, View } from 'react-native';

export default function ProfileSetupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Completa tu perfil</Text>
      <Text style={styles.subtitle}>
        Aquí podrás definir el nombre que verán otros usuarios.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#1F2937',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 16,
    marginTop: 10,
  },
});
