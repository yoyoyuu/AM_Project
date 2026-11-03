import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { useAuth } from './AuthProvider';
import { useProfile } from './useProfile';

export type AppMode = 'artist' | 'client';

const defaultMode: AppMode = 'client';

function modeStorageKey(userId: string): string {
  return `koma-app-mode:${userId}`;
}

function isAppMode(value: string | null): value is AppMode {
  return value === 'artist' || value === 'client';
}

export function useAppMode() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [mode, setModeState] = useState<AppMode>(defaultMode);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const userId = user?.id ?? '';

  useEffect(() => {
    let mounted = true;

    if (!userId) {
      return () => {
        mounted = false;
      };
    }

    void AsyncStorage.getItem(modeStorageKey(userId))
      .then((storedMode) => {
        if (!mounted) {
          return;
        }
        setModeState(isAppMode(storedMode) ? storedMode : defaultMode);
        setLoadedUserId(userId);
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }
        console.error('No se pudo recuperar el modo de uso.', error);
        setModeState(defaultMode);
        setLoadedUserId(userId);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const setMode = async (nextMode: AppMode): Promise<void> => {
    if (!userId) {
      throw new Error('No hay una sesión activa.');
    }

    const effectiveMode =
      nextMode === 'artist' && profile?.is_artist !== true
        ? defaultMode
        : nextMode;
    await AsyncStorage.setItem(modeStorageKey(userId), effectiveMode);
    setModeState(effectiveMode);
  };

  return {
    loading: userId.length > 0 && loadedUserId !== userId,
    mode: profile?.is_artist === true ? mode : defaultMode,
    setMode,
  };
}
