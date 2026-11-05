import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../features/auth/AuthProvider';

export default function AppLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Inicio' }} />
      <Stack.Screen name="buscar" options={{ title: 'Buscar artista' }} />
    </Stack>
  );
}
