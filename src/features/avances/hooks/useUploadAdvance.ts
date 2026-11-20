import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { CommissionStatus, CreativeStage } from '../../gestion/types';
import { compressAdvanceImage } from '../utils/compressAdvanceImage';
import type { PickedImage } from '../utils/pickAdvanceImages';
import { commissionAdvancesQueryKey } from './useCommissionAdvances';

export interface UploadAdvancePayload {
  commissionId: string;
  artistId: string;
  currentStatus: CommissionStatus;
  currentStage: CreativeStage;
  images: PickedImage[];
  note?: string;
}

export function useUploadAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UploadAdvancePayload) => {
      const { commissionId, artistId, currentStatus, currentStage, images, note } = payload;

      // 1. Validar estado (defensa en profundidad; RLS es la barrera principal)
      if (currentStatus !== 'EN_PROGRESO') {
        throw new Error('No puedes subir avances en una comisión que no está en progreso');
      }

      // 2. Comprimir todas las imágenes en paralelo
      const compressed = await Promise.all(images.map((img) => compressAdvanceImage(img.uri)));

      // 3. Crear el registro del avance para obtener el ID antes de subir archivos
      const { data: advance, error: advanceError } = await supabase
        .from('commission_advances')
        .insert({
          commission_id: commissionId,
          artist_id: artistId,
          stage: currentStage,
          note: note?.trim() || null,
        })
        .select('id')
        .single();

      if (advanceError || !advance) {
        throw new Error('No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo');
      }

      const advanceId = (advance as { id: string }).id;

      // 4. Subir archivos al bucket en paralelo
      const uploadResults = await Promise.all(
        compressed.map(async (img, index) => {
          const path = `${commissionId}/${advanceId}/${index}.webp`;

          const response = await fetch(img.uri);
          const blob = await response.blob();

          const { error: storageError } = await supabase.storage
            .from('commission-advances')
            .upload(path, blob, { contentType: 'image/webp', upsert: false });

          if (storageError) throw storageError;

          return { path, fileSize: img.fileSize, sortOrder: index };
        }),
      ).catch(async (err) => {
        // Limpiar el registro del avance si la subida de archivos falla
        await supabase.from('commission_advances').delete().eq('id', advanceId);
        throw new Error('No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo');
      });

      // 5. Registrar los archivos en BD
      const fileInserts = uploadResults.map((r) => ({
        advance_id: advanceId,
        storage_path: r.path,
        file_size: r.fileSize,
        sort_order: r.sortOrder,
      }));

      const { error: filesError } = await supabase
        .from('commission_advance_files')
        .insert(fileInserts);

      if (filesError) {
        // Limpiar archivos de Storage y el registro del avance
        await Promise.allSettled(
          uploadResults.map((r) =>
            supabase.storage.from('commission-advances').remove([r.path]),
          ),
        );
        await supabase.from('commission_advances').delete().eq('id', advanceId);
        throw new Error('No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo');
      }

      return advanceId;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commissionAdvancesQueryKey(variables.commissionId),
      });
    },
  });
}
