/* eslint-disable import/first */
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

import {
  ensureAndroidChannel,
  getPushPermissionState,
  requestPushPermission,
} from '../permission';
import { ANDROID_CHANNEL_ID } from '../constants';
import { NOTIFICATION_MESSAGES } from '../messages';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const notif = require('expo-notifications') as {
  setNotificationChannelAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
};

beforeEach(() => {
  notif.setNotificationChannelAsync.mockReset().mockResolvedValue(undefined);
  notif.getPermissionsAsync.mockReset();
  notif.requestPermissionsAsync.mockReset();
});

describe('getPushPermissionState', () => {
  it('returns "granted" when granted', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    expect(await getPushPermissionState()).toBe('granted');
  });

  it('returns "askable" when not granted and canAskAgain', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await getPushPermissionState()).toBe('askable');
  });

  it('returns "blocked" when not granted and canAskAgain is false', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await getPushPermissionState()).toBe('blocked');
  });
});

describe('ensureAndroidChannel', () => {
  it('creates the "default" channel with spec literals and PRIVATE visibility', async () => {
    await ensureAndroidChannel();
    expect(notif.setNotificationChannelAsync).toHaveBeenCalledWith(
      ANDROID_CHANNEL_ID,
      expect.objectContaining({
        name: NOTIFICATION_MESSAGES.channelName,
        description: NOTIFICATION_MESSAGES.channelDescription,
        importance: 4,
        lockscreenVisibility: 0,
        showBadge: false,
      }),
    );
  });
});

describe('requestPushPermission', () => {
  it('creates the Android channel BEFORE requesting the permission', async () => {
    const callOrder: string[] = [];
    notif.setNotificationChannelAsync.mockImplementation(async () => {
      callOrder.push('channel');
    });
    notif.requestPermissionsAsync.mockImplementation(async () => {
      callOrder.push('request');
      return { granted: true };
    });

    await requestPushPermission();

    expect(callOrder).toEqual(['channel', 'request']);
  });

  it('returns true when the user grants', async () => {
    notif.requestPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await requestPushPermission()).toBe(true);
  });

  it('returns false when the user denies', async () => {
    notif.requestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await requestPushPermission()).toBe(false);
  });
});
