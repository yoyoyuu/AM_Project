import { Badge } from '../../../components/ui';
import { getStatusBadge } from '../presenters';
import type { CommissionStatus } from '../types';

interface Props {
  status: CommissionStatus;
}

// Mapping per redesign spec:
// verde (success) = completado/pagado
// coral (primary) = acción o entrega lista
// neutral = pendiente, en revisión, en progreso
const STATUS_TONE: Record<CommissionStatus, 'success' | 'primary' | 'neutral'> = {
  PENDIENTE: 'neutral',
  EN_PROGRESO: 'neutral',
  EN_REVISION: 'neutral',
  COMPLETADA: 'success',
  RECHAZADA: 'primary',
  CANCELADA: 'neutral',
};

const STATUS_ICON: Partial<Record<CommissionStatus, string>> = {
  COMPLETADA: '✓',
  RECHAZADA: '!',
};

export function CommissionStatusBadge({ status }: Props) {
  const { label } = getStatusBadge(status);
  return <Badge tone={STATUS_TONE[status]} label={label} icon={STATUS_ICON[status]} />;
}
