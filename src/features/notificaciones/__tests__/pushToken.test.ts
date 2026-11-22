/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'proj-abc' } } },
    easConfig: null,
  },
}));

jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
}));

jest.mock('../../../lib/supabase', () => {
  const eq = jest.fn();
  const del = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ delete: del }));
  return {
    supabase: {
      rpc: jest.fn(),
      from,
      __mocks: { eq, del, from },
    },
  };
});

jest.mock('../permission', () => ({
  ensureAndroidChannel: jest.fn(),
}));

import { syncPushRegistration, unregisterCurrentDevice } from '../pushToken';
import { PUSH_TOKEN_STORAGE_KEY } from '../constants';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorage = require('@react-native-async-storage/async-storage').default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const notif = require('expo-notifications') as {
  getExpoPushTokenAsync: jest.Mock;
  dismissAllNotificationsAsync: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../../lib/supabase') as {
  supabase: {
    rpc: jest.Mock;
    from: jest.Mock;
    __mocks: { eq: jest.Mock; del: jest.Mock; from: jest.Mock };
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const permissionMod = require('../permission') as { ensureAndroidChannel: jest.Mock };

const TOKEN = 'ExponentPushToken[abcdefghijklmnop]';

beforeEach(() => {
  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset().mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockReset().mockResolvedValue(undefined);
  supabase.rpc.mockReset();
  supabase.__mocks.from.mockClear();
  supabase.__mocks.del.mockClear();
  supabase.__mocks.eq.mockReset();
  notif.getExpoPushTokenAsync.mockReset();
  notif.dismissAllNotificationsAsync.mockReset().mockResolvedValue(undefined);
  permissionMod.ensureAndroidChannel.mockReset().mockResolvedValue(undefined);
});

describe('syncPushRegistration', () => {
  it('calls the RPC with the token and saves it to AsyncStorage', async () => {
    notif.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
    supabase.rpc.mockResolvedValue({ error: null });

    await syncPushRegistration();

    expect(permissionMod.ensureAndroidChannel).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('register_device_token', { p_token: TOKEN });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY, TOKEN);
  });

  it('throws and does not save when the RPC returns an error', async () => {
    notif.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
    supabase.rpc.mockResolvedValue({ error: { message: 'rpc_failed' } });

    await expect(syncPushRegistration()).rejects.toBeDefined();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('unregisterCurrentDevice', () => {
  it('deletes by token and clears storage and notifications', async () => {
    AsyncStorage.getItem.mockResolvedValue(TOKEN);
    supabase.__mocks.eq.mockResolvedValue({ error: null });

    await unregisterCurrentDevice();

    expect(supabase.from).toHaveBeenCalledWith('device_tokens');
    expect(supabase.__mocks.del).toHaveBeenCalledTimes(1);
    expect(supabase.__mocks.eq).toHaveBeenCalledWith('expo_push_token', TOKEN);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY);
    expect(notif.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not throw when Supabase fails and still clears storage', async () => {
    AsyncStorage.getItem.mockResolvedValue(TOKEN);
    supabase.__mocks.eq.mockRejectedValue(new Error('network_down'));

    await expect(unregisterCurrentDevice()).resolves.toBeUndefined();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY);
    expect(notif.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not call Supabase when there is no stored token', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await unregisterCurrentDevice();

    expect(supabase.from).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY);
    expect(notif.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('resolves within 3 s when Supabase never responds (withTimeout)', async () => {
    jest.useFakeTimers();
    AsyncStorage.getItem.mockResolvedValue(TOKEN);
    // Nunca resuelve → activa el timeout de 3 s de withTimeout
    supabase.__mocks.eq.mockReturnValue(new Promise(() => {}));

    const promise = unregisterCurrentDevice();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(promise).resolves.toBeUndefined();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PUSH_TOKEN_STORAGE_KEY);
    expect(notif.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
