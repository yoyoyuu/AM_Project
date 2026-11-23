import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { useAppMode } from '../features/auth/useAppMode';
import { usePushNotifications } from '../features/notificaciones/usePushNotifications';
import '../features/notificaciones/handler';

const queryClient = new QueryClient();

/**
 * Monta usePushNotifications dentro de AuthProvider + QueryClientProvider,
 * por encima del Stack para que cubra TODAS las rutas autenticadas
 * (specs 004/005 viven en `/artist/…` y `/(tabs)/…`, hermanas de `/(app)/…`).
 */
function PushBridge() {
  const { session } = useAuth();
  const { setMode } = useAppMode();
  usePushNotifications(session?.user.id ?? null, () => {
    void setMode('artist');
  });
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PushBridge />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
