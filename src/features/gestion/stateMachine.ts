import type { CommissionStatus, CreativeStage } from './types';
import { CREATIVE_STAGE_ORDER } from './types';

export type CommissionAction = 'ACCEPT' | 'REJECT' | 'ADVANCE_STAGE';

export interface TransitionResult {
  newStatus: CommissionStatus;
  newStage: CreativeStage | null;
}

export function applyTransition(
  currentStatus: CommissionStatus,
  currentStage: CreativeStage | null,
  action: CommissionAction,
): TransitionResult {
  switch (action) {
    case 'ACCEPT': {
      if (currentStatus !== 'PENDIENTE') {
        throw new Error('Esta comisión ya no puede ser aceptada');
      }
      return { newStatus: 'EN_PROGRESO', newStage: 'SKETCH' };
    }

    case 'REJECT': {
      if (currentStatus !== 'PENDIENTE') {
        throw new Error('Esta comisión ya no puede ser rechazada');
      }
      return { newStatus: 'RECHAZADA', newStage: null };
    }

    case 'ADVANCE_STAGE': {
      if (currentStatus !== 'EN_PROGRESO') {
        throw new Error('Esta comisión ya no está en progreso');
      }
      if (currentStage === null) {
        throw new Error('Debes completar la etapa actual antes de avanzar');
      }

      const currentIndex = CREATIVE_STAGE_ORDER.indexOf(currentStage);
      const isLastStage = currentIndex === CREATIVE_STAGE_ORDER.length - 1;

      if (isLastStage) {
        return { newStatus: 'COMPLETADA', newStage: null };
      }

      const nextStage = CREATIVE_STAGE_ORDER[currentIndex + 1];
      return { newStatus: 'EN_PROGRESO', newStage: nextStage };
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Acción desconocida: ${_exhaustive}`);
    }
  }
}

export function getStageName(stage: CreativeStage): string {
  const names: Record<CreativeStage, string> = {
    SKETCH: 'Boceto',
    LINEART: 'Delineado',
    FINAL: 'Color / Acabado final',
  };
  return names[stage];
}
