import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import { toPaymentError } from '../errors';

export function useRequestPaymentCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commissionId,
      reason,
    }: {
      commissionId: string;
      reason: string;
    }) => {
      const { error } = await supabase.rpc('request_payment_correction', {
        p_commission_id: commissionId,
        p_reason: reason.trim(),
      });
      if (error) throw toPaymentError('REQUEST_CORRECTION', error);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
