import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { CommissionWithDetails } from '../types';

export const activeCommissionsQueryKey = (artistId: string) =>
  ['commissions', 'active', artistId] as const;

export function useActiveCommissions(artistId: string) {
  return useQuery({
    queryKey: activeCommissionsQueryKey(artistId),
    queryFn: async (): Promise<CommissionWithDetails[]> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          service:services (title, price_mxn, delivery_days),
          client_profile:profiles!client_id (handle, display_name),
          references:commission_references (*)
        `)
        .in('status', ['EN_PROGRESO', 'EN_REVISION', 'COMPLETADA'])
        .eq('artist_id', artistId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as CommissionWithDetails[];
    },
    staleTime: 1000 * 30,
    enabled: !!artistId,
  });
}
