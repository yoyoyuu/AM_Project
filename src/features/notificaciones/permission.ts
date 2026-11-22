import {
  AndroidImportance,
  AndroidNotificationVisibility,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { ANDROID_CHANNEL_ID } from './constants';
import { NOTIFICATION_MESSAGES } from './messages';

export type PushPermissionState = 'granted' | 'askable' | 'blocked';

/**
 * Android 13+: el canal debe existir ANTES de pedir el permiso para que aparezca el diálogo.
 * PRIVATE: en pantallas de bloqueo seguras con «ocultar contenido sensible», Android oculta
 * el texto (RNF-NOT-8.1, defensa adicional; el contenido ya es discreto).
 */
export async function ensureAndroidChannel(): Promise<void> {
  await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: NOTIFICATION_MESSAGES.channelName,
    description: NOTIFICATION_MESSAGES.channelDescription,
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  const p = await getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'askable' : 'blocked';
}

/** Muestra el diálogo de Android (si aplica). No registra nada. */
export async function requestPushPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const res = await requestPermissionsAsync();
  return res.granted;
}
