import { useMutation } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { supabase } from '../../../lib/supabase';
import type { CommissionRequestFormValues } from '../schemas';
import type { LocalImageAsset } from '../types';
import { compressImage } from '../utils/compressImage';

export interface SubmitCommissionPayload {
  artistId: string;
  serviceId: string;
  form: CommissionRequestFormValues;
  images: LocalImageAsset[];
  hasArtistTos: boolean;
}

export function useSubmitCommission() {
  return useMutation({
    mutationFn: async (payload: SubmitCommissionPayload) => {
      const { artistId, serviceId, form, images, hasArtistTos } = payload;

      // 1. Obtener el UUID del cliente (requerido por la política RLS).
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(
          'No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo',
        );
      }

      // 2. Crear la comisión primero para obtener su ID real.
      //    El storage RLS valida que el path comience con un commission_id válido.
      const { data: commission, error: commError } = await supabase
        .from('commissions')
        .insert({
          client_id: user.id,
          artist_id: artistId,
          service_id: serviceId,
          description: form.description,
          pose: form.pose ?? null,
          key_elements: form.key_elements ?? null,
          intended_use: form.intended_use,
          additional_notes: form.additional_notes ?? null,
          terms_accepted_at: hasArtistTos ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (commError ?? !commission) {
        throw new Error(
          'No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo',
        );
      }

      // 3. Comprimir y subir imágenes usando el ID real de la comisión.
      if (images.length > 0) {
        const uploadedPaths: { path: string; size: number }[] = [];

        for (const img of images) {
          const compressed = await compressImage(img);
          const fileName = `${commission.id}/${Date.now()}-${img.fileName}`;

          // React Native's Blob API doesn't support creation from ArrayBuffer.
          // Read as base64 and decode to Uint8Array — the only reliable upload
          // path from a local file:// URI in React Native + Supabase storage.
          const base64 = await new File(compressed.uri).base64();
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const { error: uploadError } = await supabase.storage
            .from('commission-references')
            .upload(fileName, bytes, { contentType: 'image/jpeg' });

          if (uploadError) {
            throw new Error(
              'No se pudo subir una o más imágenes. Comprueba tu conexión e inténtalo de nuevo',
            );
          }

          uploadedPaths.push({ path: fileName, size: bytes.byteLength });
        }

        // 4. Insertar referencias de imágenes
        const refs = uploadedPaths.map((p) => ({
          commission_id: commission.id,
          storage_path: p.path,
          file_size: p.size,
        }));

        const { error: refError } = await supabase
          .from('commission_references')
          .insert(refs);

        if (refError) {
          throw new Error(
            'No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo',
          );
        }
      }

      return commission;
    },
  });
}
