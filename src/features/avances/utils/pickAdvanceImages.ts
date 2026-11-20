import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Abre el selector de imágenes de la galería.
 * Permite seleccionar entre 1 y 3 imágenes.
 * Retorna null si el usuario cancela.
 */
export async function pickAdvanceImages(): Promise<PickedImage[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 3,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return null;

  return result.assets.map((asset) => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}
