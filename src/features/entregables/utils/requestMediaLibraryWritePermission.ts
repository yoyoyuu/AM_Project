import * as MediaLibrary from 'expo-media-library';

export type WritePermissionResult =
  | { granted: true }
  | { granted: false; canAskAgain: boolean };

export async function requestMediaLibraryWritePermission(): Promise<WritePermissionResult> {
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (current.granted) return { granted: true };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false };
  const res = await MediaLibrary.requestPermissionsAsync(true);
  return res.granted ? { granted: true } : { granted: false, canAskAgain: res.canAskAgain };
}
