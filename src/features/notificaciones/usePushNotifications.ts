import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  addPushTokenListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  type NotificationResponse,
} from 'expo-notifications';
import { getPushPermissionState } from './permission';
import { syncPushRegistration } from './pushToken';
import { parsePushData, resolveNotificationRoute } from './routing';

/**
 * Se monta UNA vez en el layout autenticado. userId = null ⇒ no hace nada.
 * onArtistTarget: callback opcional para poner el modo artista (Spec 001, useAppMode).
 */
export function usePushNotifications(userId: string | null, onArtistTarget?: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 1. Registro silencioso si el permiso ya está concedido (Escenarios 8.7, 8.9 reintento)
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      if ((await getPushPermissionState()) !== 'granted') return;
      await syncPushRegistration().catch(() => undefined);
    })();
  }, [userId]);

  // 2. Rotación del token de FCM ⇒ se vuelve a registrar
  useEffect(() => {
    if (!userId) return;
    const sub = addPushTokenListener(() => {
      void syncPushRegistration().catch(() => undefined);
    });
    return () => sub.remove();
  }, [userId]);

  // 3. Aviso recibido con la app abierta ⇒ refrescar datos (Escenario 8.25).
  //    Todas las queries de pago/entregable cuelgan del prefijo ['commissions'] (DT-7.7).
  useEffect(() => {
    const sub = addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['commissions'] });
    });
    return () => sub.remove();
  }, [queryClient]);

  // 4. Toque del aviso: app en segundo plano o cerrada (cold start) — RF-28-A
  useEffect(() => {
    if (!userId) return;

    const handle = (response: NotificationResponse) => {
      const data = parsePushData(response.notification.request.content.data);
      const route = data ? resolveNotificationRoute(data, userId) : null;
      clearLastNotificationResponse();
      if (!route || !data) return;
      if (data.target !== 'client_tracking') onArtistTarget?.();
      void queryClient.invalidateQueries({ queryKey: ['commissions'] });
      router.push(route);
    };

    const last = getLastNotificationResponse();
    if (last) handle(last);

    const sub = addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [userId, router, queryClient, onArtistTarget]);
}
