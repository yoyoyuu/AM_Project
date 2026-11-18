import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../features/auth/AuthProvider';

export default function TabsLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="commissions/index" options={{ title: 'Mis Comisiones' }} />
      <Stack.Screen name="commissions/[commissionId]" options={{ title: 'Detalle del encargo' }} />
    </Stack>
  );
}
