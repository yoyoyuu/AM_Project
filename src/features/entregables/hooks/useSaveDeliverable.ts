import { useMutation } from '@tanstack/react-query';
import { Linking } from 'react-native';

import { requestMediaLibraryWritePermission } from '../utils/requestMediaLibraryWritePermission';
import { saveDeliverableToGallery, SaveDeliverableError } from '../utils/saveDeliverableToGallery';

export const SAVE_MESSAGES = {
  success:  'Ilustración guardada en tu galería',
  denied:   'No se pudo guardar porque no diste permiso de acceso a tu galería. Puedes habilitarlo en los ajustes de tu dispositivo',
  locked:   'La descarga se habilitará cuando el pago esté liquidado',
  network:  'No se pudo descargar el entregable. Comprueba tu conexión e inténtalo de nuevo',
  no_space: 'No hay espacio suficiente en tu dispositivo para guardar el archivo',
  unknown:  'No se pudo descargar el entregable. Comprueba tu conexión e inténtalo de nuevo',
} as const;

export type SaveOutcome =
  | { ok: true }
  | { ok: false; message: string; showOpenSettings: boolean };

export function useSaveDeliverable() {
  return useMutation({
    mutationFn: async (p: {
      commissionId: string;
      deliverablePath: string;
    }): Promise<SaveOutcome> => {
      const perm = await requestMediaLibraryWritePermission();
      if (!perm.granted) {
        return { ok: false, message: SAVE_MESSAGES.denied, showOpenSettings: true };
      }
      try {
        await saveDeliverableToGallery(p.deliverablePath, p.commissionId);
        return { ok: true };
      } catch (e) {
        const code = e instanceof SaveDeliverableError ? e.code : 'unknown';
        return { ok: false, message: SAVE_MESSAGES[code], showOpenSettings: false };
      }
    },
  });
}

export const openAppSettings = () => Linking.openSettings();
