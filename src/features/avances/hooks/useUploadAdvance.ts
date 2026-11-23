import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

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
        console.error('[UPLOAD ADVANCE] advance insert failed:', advanceError);
        throw new Error('No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo');
      }

      const advanceId = (advance as { id: string }).id;

      // 4. Subir archivos al bucket en paralelo
      const uploadResults = await Promise.all(
        compressed.map(async (img, index) => {
          const path = `${commissionId}/${advanceId}/${index}.webp`;

          // RN's Blob no setea MIME correctamente; Supabase Storage lo rechaza.
          // Leer como base64 → Uint8Array y subir bytes directo (mismo patrón que useSubmitCommission).
          const base64 = await new File(img.uri).base64();
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const { error: storageError } = await supabase.storage
            .from('commission-advances')
            .upload(path, bytes, { contentType: 'image/webp', upsert: false });

          if (storageError) throw storageError;

          return { path, fileSize: img.fileSize, sortOrder: index };
        }),
      ).catch(async (err) => {
        console.error('[UPLOAD ADVANCE] storage upload failed:', err);
        // Limpiar el registro del avance si la subida de archivos falla
        const { error: cleanupError } = await supabase.from('commission_advances').delete().eq('id', advanceId);
        if (cleanupError) console.error('[UPLOAD ADVANCE] advance cleanup failed:', cleanupError);
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
        console.error('[UPLOAD ADVANCE] files insert failed:', filesError);
        console.error('[UPLOAD ADVANCE] file inserts payload:', JSON.stringify(fileInserts));
        // Limpiar archivos de Storage y el registro del avance
        await Promise.allSettled(
          uploadResults.map((r) =>
            supabase.storage.from('commission-advances').remove([r.path]),
          ),
        );
        const { error: cleanupError } = await supabase.from('commission_advances').delete().eq('id', advanceId);
        if (cleanupError) console.error('[UPLOAD ADVANCE] advance cleanup failed:', cleanupError);
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
