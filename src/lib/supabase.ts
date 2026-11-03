import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const encryptionKeyName = 'koma-session-encryption-key';

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY.',
  );
}

const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const encryptedValue = await AsyncStorage.getItem(key);
    if (encryptedValue === null) {
      return null;
    }

    const encryptionKey = await getEncryptionKey();
    if (encryptedValue.startsWith('U2FsdGVkX1')) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const sealedData = AESSealedData.fromCombined(encryptedValue);
    const decryptedBase64 = await aesDecryptAsync(sealedData, encryptionKey, {
      output: 'base64',
    });
    const decryptedValue = decodeBase64(decryptedBase64);

    if (!decryptedValue) {
      throw new Error('No se pudo descifrar la sesión almacenada.');
    }

    return decryptedValue;
  },

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await getEncryptionKey();
    const sealedData = await aesEncryptAsync(
      encodeBase64(value),
      encryptionKey,
    );
    const encryptedValue = await sealedData.combined('base64');
    await AsyncStorage.setItem(key, encryptedValue);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

async function getEncryptionKey(): Promise<AESEncryptionKey> {
  const storedKey = await SecureStore.getItemAsync(encryptionKeyName);
  if (storedKey !== null) {
    return AESEncryptionKey.import(storedKey, 'hex');
  }

  const encryptionKey = await AESEncryptionKey.generate(256);
  const generatedKey = await encryptionKey.encoded('hex');
  await SecureStore.setItemAsync(encryptionKeyName, generatedKey);
  return encryptionKey;
}

function encodeBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64(value: string): string {
  return decodeURIComponent(escape(atob(value)));
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: sessionStorage,
    },
  },
);

function updateAutoRefresh(nextState: string): void {
  const autoRefreshOperation =
    nextState === 'active'
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh();

  void autoRefreshOperation.catch((error: unknown) => {
    console.error('No se pudo actualizar el refresco de sesión.', error);
  });
}

if (AppState.currentState === 'active') {
  updateAutoRefresh('active');
}

AppState.addEventListener('change', updateAutoRefresh);
