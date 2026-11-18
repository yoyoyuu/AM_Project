import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import type { ClientCommissionDetail, CommissionReferenceView } from '../types';

export const commissionTrackingDetailQueryKey = (commissionId: string) =>
  ['commissions', 'client', 'detail', commissionId] as const;

export function useCommissionTrackingDetail(commissionId: string) {
  return useQuery({
    queryKey: commissionTrackingDetailQueryKey(commissionId),
    queryFn: async (): Promise<ClientCommissionDetail> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id,
          status,
          current_stage,
          rejection_reason,
          description,
          intended_use,
          pose,
          key_elements,
          additional_notes,
          updated_at,
          created_at,
          service:services!service_id (title, price_mxn, delivery_days),
          artist:profiles!artist_id (handle, display_name),
          references:commission_references (id, storage_path)
        `)
        .eq('id', commissionId)
        .single();

      if (error) throw error;

      const row = data as any;

      // Generar URLs firmadas para las referencias (expiración 1 h)
      const refsWithUrls: CommissionReferenceView[] = await Promise.all(
        (row.references ?? []).map(async (ref: { id: string; storage_path: string }) => {
          const { data: signed } = await supabase.storage
            .from('commission-references')
            .createSignedUrl(ref.storage_path, 3600);
          return {
            id: ref.id,
            storage_path: ref.storage_path,
            signed_url: signed?.signedUrl ?? null,
          };
        }),
      );

      return {
        id: row.id,
        status: row.status,
        current_stage: row.current_stage,
        rejection_reason: row.rejection_reason,
        updated_at: row.updated_at,
        created_at: row.created_at,
        service_title: row.service?.title ?? '',
        service_base_price: row.service?.price_mxn ?? 0,
        service_estimated_days: row.service?.delivery_days ?? 0,
        artist_handle: row.artist?.handle ?? '',
        artist_display_name: row.artist?.display_name ?? null,
        description: row.description,
        intended_use: row.intended_use,
        pose: row.pose,
        key_elements: row.key_elements,
        additional_notes: row.additional_notes,
        references: refsWithUrls,
      };
    },
    staleTime: 1000 * 30,
  });
}
