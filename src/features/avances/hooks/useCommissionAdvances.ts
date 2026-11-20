import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { CommissionAdvance, CommissionAdvanceFile } from '../types';

export const commissionAdvancesQueryKey = (commissionId: string) =>
  ['commissions', 'advances', commissionId] as const;

export function useCommissionAdvances(commissionId: string) {
  return useQuery({
    queryKey: commissionAdvancesQueryKey(commissionId),
    queryFn: async (): Promise<CommissionAdvance[]> => {
      const { data, error } = await supabase
        .from('commission_advances')
        .select(`
          *,
          files:commission_advance_files (*)
        `)
        .eq('commission_id', commissionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const advancesWithUrls = await Promise.all(
        (data ?? []).map(async (advance) => {
          const filesWithUrls: CommissionAdvanceFile[] = await Promise.all(
            (advance.files ?? []).map(async (file: { id: string; advance_id: string; storage_path: string; file_size: number; sort_order: number; created_at: string }) => {
              const { data: signed } = await supabase.storage
                .from('commission-advances')
                .createSignedUrl(file.storage_path, 3600);
              return {
                id: file.id,
                advance_id: file.advance_id,
                storage_path: file.storage_path,
                file_size: file.file_size,
                sort_order: file.sort_order,
                signed_url: signed?.signedUrl ?? null,
              };
            }),
          );
          return {
            id: advance.id as string,
            commission_id: advance.commission_id as string,
            artist_id: advance.artist_id as string,
            stage: advance.stage,
            note: advance.note as string | null,
            created_at: advance.created_at as string,
            files: filesWithUrls,
          } satisfies CommissionAdvance;
        }),
      );

      return advancesWithUrls;
    },
    staleTime: 1000 * 60,
  });
}
