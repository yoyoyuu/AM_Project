import * as ImagePicker from 'expo-image-picker';

export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
  fileSize: number | null;
  mimeType: string | null;
}

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** Abre la galería para elegir UNA imagen. Devuelve null si el usuario cancela. */
export async function pickSingleImage(): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    fileSize: a.fileSize ?? null,
    mimeType: a.mimeType ?? null,
  };
}

export function isAllowedSource(asset: PickedAsset): boolean {
  const mimeOk =
    asset.mimeType !== null &&
    (ALLOWED_IMAGE_MIME as readonly string[]).includes(asset.mimeType);
  const sizeOk = asset.fileSize === null || asset.fileSize <= MAX_SOURCE_BYTES;
  return mimeOk && sizeOk;
}
