import { useMutation } from '@tanstack/react-query';

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

      // 1. Comprimir y subir imágenes al bucket
      const uploadedPaths: { path: string; size: number }[] = [];
      const tempCommissionId = crypto.randomUUID();

      for (const img of images) {
        const compressed = await compressImage(img);
        const fileName = `${tempCommissionId}/${Date.now()}-${img.fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('commission-references')
          .upload(fileName, compressed.blob, { contentType: 'image/jpeg' });

        if (uploadError) {
          throw new Error(
            'No se pudo subir una o más imágenes. Comprueba tu conexión e inténtalo de nuevo',
          );
        }

        uploadedPaths.push({ path: fileName, size: compressed.size });
      }

      // 2. Insertar la comisión
      const { data: commission, error: commError } = await supabase
        .from('commissions')
        .insert({
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

      // 3. Insertar referencias de imágenes
      if (uploadedPaths.length > 0) {
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
