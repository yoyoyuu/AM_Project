import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';
import { applyTransition } from '../stateMachine';
import type { CommissionAction } from '../stateMachine';
import type { CommissionStatus, CreativeStage } from '../types';
import { commissionDetailQueryKey } from './useCommissionDetail';
import { pendingCommissionsQueryKey } from './usePendingCommissions';

interface ActionPayload {
  commissionId: string;
  artistId: string;
  currentStatus: CommissionStatus;
  currentStage: CreativeStage | null;
  action: CommissionAction;
  rejectionReason?: string;
}

export function useCommissionAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ActionPayload) => {
      const { commissionId, artistId, currentStatus, currentStage, action, rejectionReason } =
        payload;

      const { newStatus, newStage } = applyTransition(currentStatus, currentStage, action);

      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        current_stage: newStage,
      };

      if (action === 'REJECT') {
        updatePayload.rejection_reason = rejectionReason?.trim() || null;
      }

      const { error } = await supabase
        .from('commissions')
        .update(updatePayload)
        .eq('id', commissionId)
        .eq('artist_id', artistId)
        .eq('status', currentStatus);

      if (error) {
        throw new Error(
          'No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo',
        );
      }

      return { newStatus, newStage };
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: pendingCommissionsQueryKey(variables.artistId),
      });
      queryClient.invalidateQueries({
        queryKey: commissionDetailQueryKey(variables.commissionId),
      });
    },
  });
}
