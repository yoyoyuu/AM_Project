import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

import type { LocalImageAsset } from '../types';

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.75;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function compressImage(
  asset: LocalImageAsset,
): Promise<{ blob: Blob; size: number }> {
  const { width, height } = await getImageSize(asset.uri);

  const context = ImageManipulator.manipulate(asset.uri);

  // Only resize if the image exceeds the max dimension
  if (width >= height && width > MAX_DIMENSION) {
    context.resize({ width: MAX_DIMENSION });
  } else if (height > width && height > MAX_DIMENSION) {
    context.resize({ height: MAX_DIMENSION });
  }

  const ref = await context.renderAsync();
  const result = await ref.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });

  const response = await fetch(result.uri);
  const blob = await response.blob();
  return { blob, size: blob.size };
}
