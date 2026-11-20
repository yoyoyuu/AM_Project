import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import { newObjectId, removeQuietly, uploadLocalFile } from '../../../lib/storage/uploadLocalFile';
import { compressPaymentProof } from '../utils/compressPaymentProof';
import { toPaymentError } from '../errors';
import type { PickedAsset } from '../../../lib/media/pickSingleImage';

interface Payload {
  commissionId: string;
  asset: PickedAsset;
  reference?: string;
  note?: string;
}

const BUCKET = 'payment-proofs';

export function useSubmitPaymentProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commissionId, asset, reference, note }: Payload) => {
      const proof = await compressPaymentProof(asset.uri, asset.width, asset.height);
      const path = `${commissionId}/${newObjectId()}.jpg`;

      try {
        await uploadLocalFile(BUCKET, path, proof.uri, 'image/jpeg');
      } catch (e) {
        throw toPaymentError('SUBMIT_PROOF', e as Error);
      }

      const { error } = await supabase.rpc('submit_payment_proof', {
        p_commission_id: commissionId,
        p_proof_path: path,
        p_reference: reference?.trim() || null,
        p_note: note?.trim() || null,
      });
      if (error) {
        await removeQuietly(BUCKET, path);
        throw toPaymentError('SUBMIT_PROOF', error);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
