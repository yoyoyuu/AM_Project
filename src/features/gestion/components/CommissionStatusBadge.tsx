import { Badge } from '../../../components/ui';
import type { CommissionStatus } from '../types';

interface Props {
  status: CommissionStatus;
}

const LABEL: Record<CommissionStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  RECHAZADA: 'Rechazada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  EN_REVISION: 'En revisión',
};

const TONE: Record<CommissionStatus, 'success' | 'primary' | 'neutral'> = {
  PENDIENTE: 'neutral',
  EN_PROGRESO: 'neutral',
  EN_REVISION: 'neutral',
  COMPLETADA: 'success',
  RECHAZADA: 'primary',
  CANCELADA: 'neutral',
};

const ICON: Partial<Record<CommissionStatus, string>> = {
  COMPLETADA: '✓',
  RECHAZADA: '!',
};

export function CommissionStatusBadge({ status }: Props) {
  return <Badge tone={TONE[status]} label={LABEL[status]} icon={ICON[status]} />;
}
