import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../features/auth/AuthProvider';

export default function ArtistLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="commissions/index" options={{ title: 'Mis comisiones' }} />
      <Stack.Screen
        name="commissions/[commissionId]/index"
        options={{ title: 'Detalle de comisión' }}
      />
      <Stack.Screen
        name="commissions/[commissionId]/work"
        options={{ title: 'Panel de trabajo' }}
      />
      <Stack.Screen
        name="commissions/[commissionId]/completed"
        options={{ title: 'Comisión completada' }}
      />
    </Stack>
  );
}
