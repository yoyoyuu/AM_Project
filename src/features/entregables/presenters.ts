import type { CommissionPayment } from '../pagos/types';

export type ClientDeliverableView = 'NOT_UPLOADED' | 'LOCKED' | 'UNLOCKED';

/** Tabla de RF-12-A. La UI es un reflejo; el bloqueo real está en Storage RLS. */
export function getClientDeliverableView(
  p: Pick<CommissionPayment, 'payment_status' | 'deliverable_path'>,
): ClientDeliverableView {
  if (p.deliverable_path === null) return 'NOT_UPLOADED';
  return p.payment_status === 'VERIFIED' ? 'UNLOCKED' : 'LOCKED';
}

export function canArtistUploadDeliverable(
  p: Pick<CommissionPayment, 'status' | 'current_stage'>,
): boolean {
  return p.status === 'EN_PROGRESO' && p.current_stage === 'FINAL';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
