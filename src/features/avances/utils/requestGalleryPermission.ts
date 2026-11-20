import * as ImagePicker from 'expo-image-picker';

export type GalleryPermissionResult =
  | { granted: true }
  | { granted: false; canAskAgain: boolean };

/**
 * Solicita permiso de acceso a la galería y retorna el resultado.
 * No lanza excepción: el llamador decide cómo manejar la denegación.
 */
export async function requestGalleryPermission(): Promise<GalleryPermissionResult> {
  const { status, canAskAgain } =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status === 'granted') {
    return { granted: true };
  }
  return { granted: false, canAskAgain };
}
