import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export async function requestGalleryPermission(): Promise<boolean> {
  const { granted, canAskAgain } =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (granted) return true;

  if (!canAskAgain) {
    Alert.alert(
      'Permiso de galería',
      'Permiso de galería denegado. Puedes habilitarlo en Ajustes del sistema',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => void Linking.openSettings() },
      ],
    );
  }

  return false;
}
