import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { CommissionPayment } from '../types';

export const commissionPaymentQueryKey = (commissionId: string) =>
  ['commissions', 'payment', commissionId] as const;

export function useCommissionPayment(commissionId: string) {
  return useQuery({
    queryKey: commissionPaymentQueryKey(commissionId),
    queryFn: async (): Promise<CommissionPayment> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id, client_id, artist_id, status, current_stage,
          payment_status, payment_proof_path, payment_proof_uploaded_at,
          payment_reference, payment_note, payment_correction_reason, paid_verified_at,
          deliverable_path, deliverable_size, delivered_at,
          service:services (price_mxn)
        `)
        .eq('id', commissionId)
        .single<Omit<CommissionPayment, 'base_price'> & { service: { price_mxn: number } | null }>();
      if (error) throw error;
      const { service, ...rest } = data;
      return { ...rest, base_price: service?.price_mxn ?? 0 };
    },
    staleTime: 1000 * 15,
  });
}
