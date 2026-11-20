import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';

export function usePaymentProofUrl(path: string | null) {
  return useQuery({
    queryKey: ['commissions', 'payment-proof-url', path],
    enabled: path !== null,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(path as string, 300);
      if (error) throw new Error('No se pudo cargar el comprobante. Inténtalo de nuevo');
      return data.signedUrl;
    },
    staleTime: 1000 * 60 * 4,
    gcTime: 1000 * 60 * 5,
  });
}
