import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  dismissAllNotificationsAsync,
  getExpoPushTokenAsync,
} from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { PUSH_TOKEN_STORAGE_KEY, UNREGISTER_TIMEOUT_MS } from './constants';
import { ensureAndroidChannel } from './permission';

export async function getExpoPushToken(): Promise<string> {
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('missing_eas_project_id');
  const { data } = await getExpoPushTokenAsync({ projectId });
  return data;
}

/** RF-25-A: upsert con reasignación (RPC register_device_token). Requiere permiso concedido. */
export async function syncPushRegistration(): Promise<void> {
  await ensureAndroidChannel();
  const token = await getExpoPushToken();
  const { error } = await supabase.rpc('register_device_token', { p_token: token });
  if (error) throw error;
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * RF-25-B. Se llama ANTES de supabase.auth.signOut(), con el JWT aún vigente (RLS DELETE).
 * Nunca lanza y nunca tarda más de UNREGISTER_TIMEOUT_MS en la parte de red.
 */
export async function unregisterCurrentDevice(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      await withTimeout(
        supabase.from('device_tokens').delete().eq('expo_push_token', token),
        UNREGISTER_TIMEOUT_MS,
      );
    }
  } catch {
    // Sin conexión o timeout: el dispositivo se reasigna en el próximo inicio de sesión (P-8.7).
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY).catch(() => undefined);
    await dismissAllNotificationsAsync().catch(() => undefined);
  }
}
