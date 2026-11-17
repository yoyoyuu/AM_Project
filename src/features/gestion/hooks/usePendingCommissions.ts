import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { CommissionWithDetails } from '../types';

export const pendingCommissionsQueryKey = (artistId: string) =>
  ['commissions', 'pending', artistId] as const;

export function usePendingCommissions(artistId: string) {
  return useQuery({
    queryKey: pendingCommissionsQueryKey(artistId),
    queryFn: async (): Promise<CommissionWithDetails[]> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          service:services (title, base_price, estimated_days),
          client_profile:profiles!client_id (handle, display_name),
          references:commission_references (*)
        `)
        .eq('status', 'PENDIENTE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CommissionWithDetails[];
    },
    staleTime: 1000 * 30,
  });
}
