import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

const MAX_DIMENSION = 1080;
const COMPRESS_QUALITY = 0.72;

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
}

/**
 * Redimensiona y comprime una imagen para subida como avance WIP.
 * Parámetros elegidos para mantener peso ≤ 300 KB en la mayoría de las imágenes.
 */
export async function compressAdvanceImage(uri: string): Promise<CompressedImage> {
  const imageRef = await ImageManipulator.manipulate(uri)
    .resize({ width: MAX_DIMENSION })
    .renderAsync();

  const result = await imageRef.saveAsync({
    compress: COMPRESS_QUALITY,
    format: SaveFormat.WEBP,
  });

  const fileSize = new File(result.uri).size;

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    fileSize,
  };
}
