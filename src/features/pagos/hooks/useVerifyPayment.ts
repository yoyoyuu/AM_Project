import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import { toPaymentError } from '../errors';
import type { CommissionStatus } from '../../gestion/types';

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commissionId: string): Promise<CommissionStatus> => {
      const { data, error } = await supabase.rpc('verify_payment', {
        p_commission_id: commissionId,
      });
      if (error) throw toPaymentError('VERIFY', error);
      return data as CommissionStatus;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
