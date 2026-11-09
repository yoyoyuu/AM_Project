import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { LocalImageAsset } from '../types';

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.75;

// Lazy require keeps react-native out of the module-level import graph,
// which lets jest-expo/node tests inject getDimensions without triggering
// the react-native → react-native-web resolution that fails without that package.
export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require('react-native') as {
    Image: {
      getSize: (
        uri: string,
        success: (w: number, h: number) => void,
        failure?: (e: unknown) => void,
      ) => void;
    };
  };
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function compressImage(
  asset: LocalImageAsset,
  getDimensions: (uri: string) => Promise<{ width: number; height: number }> = getImageSize,
): Promise<{ uri: string }> {
  const { width, height } = await getDimensions(asset.uri);

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

  return { uri: result.uri };
}
