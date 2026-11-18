import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { ClientCommissionSummary } from '../types';

export const myCommissionsQueryKey = (clientId: string) =>
  ['commissions', 'client', clientId, 'list'] as const;

export function useMyCommissions(clientId: string) {
  return useQuery({
    queryKey: myCommissionsQueryKey(clientId),
    queryFn: async (): Promise<ClientCommissionSummary[]> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id,
          status,
          current_stage,
          rejection_reason,
          updated_at,
          created_at,
          service:services!service_id (title),
          artist:profiles!artist_id (handle, display_name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        status: row.status,
        current_stage: row.current_stage,
        rejection_reason: row.rejection_reason,
        updated_at: row.updated_at,
        created_at: row.created_at,
        service_title: row.service?.title ?? '',
        artist_handle: row.artist?.handle ?? '',
        artist_display_name: row.artist?.display_name ?? null,
      }));
    },
    staleTime: 1000 * 30,
    // refetchOnWindowFocus: true es el valor por defecto de TanStack Query (cubre RF-05-C)
  });
}
