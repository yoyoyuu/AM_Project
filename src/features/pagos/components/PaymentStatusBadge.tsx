import { Badge } from '../../../components/ui';
import { getPaymentBadge } from '../presenters';
import type { PaymentStatus } from '../types';

interface Props {
  status: PaymentStatus;
}

const TONE_MAP = {
  warning: 'neutral',
  info: 'neutral',
  error: 'primary',
  success: 'success',
} as const;

export function PaymentStatusBadge({ status }: Props) {
  const { label, colorKey } = getPaymentBadge(status);
  const tone = TONE_MAP[colorKey];
  return <Badge tone={tone} label={label} icon={tone === 'success' ? '✓' : undefined} />;
}
