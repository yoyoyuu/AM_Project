import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
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
    const decryptedValue = CryptoJS.AES.decrypt(
      encryptedValue,
      encryptionKey,
    ).toString(CryptoJS.enc.Utf8);

    if (!decryptedValue) {
      throw new Error('No se pudo descifrar la sesión almacenada.');
    }

    return decryptedValue;
  },

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await getEncryptionKey();
    const encryptedValue = CryptoJS.AES.encrypt(value, encryptionKey).toString();
    await AsyncStorage.setItem(key, encryptedValue);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

async function getEncryptionKey(): Promise<string> {
  const storedKey = await SecureStore.getItemAsync(encryptionKeyName);
  if (storedKey !== null) {
    return storedKey;
  }

  const generatedKey = CryptoJS.lib.WordArray.random(32).toString();
  await SecureStore.setItemAsync(encryptionKeyName, generatedKey);
  return generatedKey;
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
