import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { CommissionWithDetails } from '../types';

export const commissionDetailQueryKey = (commissionId: string) =>
  ['commissions', 'detail', commissionId] as const;

export function useCommissionDetail(commissionId: string) {
  return useQuery({
    queryKey: commissionDetailQueryKey(commissionId),
    queryFn: async (): Promise<CommissionWithDetails> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          service:services (title, base_price, estimated_days),
          client_profile:profiles!client_id (handle, display_name),
          references:commission_references (*)
        `)
        .eq('id', commissionId)
        .single();

      if (error) throw error;

      const refsWithUrls = await Promise.all(
        ((data.references ?? []) as { storage_path: string; [key: string]: unknown }[]).map(
          async (ref) => {
            const { data: signed } = await supabase.storage
              .from('commission-references')
              .createSignedUrl(ref.storage_path, 3600);
            return { ...ref, signed_url: signed?.signedUrl ?? null };
          },
        ),
      );

      return { ...data, references: refsWithUrls } as CommissionWithDetails;
    },
  });
}
