import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import { newObjectId, removeQuietly, uploadLocalFile } from '../../../lib/storage/uploadLocalFile';
import { prepareDeliverableImage } from '../utils/prepareDeliverableImage';
import type { PreparedDeliverable } from '../utils/prepareDeliverableImage';
import { PaymentError, toPaymentError } from '../../pagos/errors';
import type { CommissionStatus } from '../../gestion/types';
import type { PickedAsset } from '../../../lib/media/pickSingleImage';

interface Payload {
  commissionId: string;
  asset: PickedAsset;
  previousPath: string | null;
}

const BUCKET = 'commission-deliverables';

export function useSubmitDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Payload): Promise<CommissionStatus> => {
      let prepared: PreparedDeliverable;
      try {
        prepared = await prepareDeliverableImage(p.asset);
      } catch (e) {
        const msg =
          (e as Error).message === 'unsupported_format'
            ? 'Formato no permitido. Usa una imagen JPG, PNG o WEBP'
            : 'El archivo supera el tamaño máximo de 10 MB incluso después de optimizarlo';
        throw new PaymentError(msg);
      }

      const path = `${p.commissionId}/final-${newObjectId()}.${prepared.extension}`;
      try {
        await uploadLocalFile(BUCKET, path, prepared.uri, prepared.mimeType);
      } catch (e) {
        throw toPaymentError('SUBMIT_DELIVERABLE', e as Error);
      }

      const { data, error } = await supabase.rpc('submit_deliverable', {
        p_commission_id: p.commissionId,
        p_deliverable_path: path,
        p_file_size: prepared.size,
      });
      if (error) {
        await removeQuietly(BUCKET, path);
        throw toPaymentError('SUBMIT_DELIVERABLE', error);
      }
      // Previous path is no longer current — DELETE policy allows removal
      if (p.previousPath) await removeQuietly(BUCKET, p.previousPath);
      return data as CommissionStatus;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
