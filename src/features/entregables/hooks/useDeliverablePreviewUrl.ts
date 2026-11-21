import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';

export function useDeliverablePreviewUrl(path: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['commissions', 'deliverable-url', path],
    enabled: enabled && path !== null,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('commission-deliverables')
        .createSignedUrl(path as string, 600);
      if (error) throw new Error('La descarga se habilitará cuando el pago esté liquidado');
      return data.signedUrl;
    },
    staleTime: 1000 * 60 * 9,
    gcTime: 1000 * 60 * 10,
  });
}
