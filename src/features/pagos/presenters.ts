import type { CommissionPayment, PaymentStatus } from './types';

export interface PaymentBadgeConfig {
  label: string;
  colorKey: 'warning' | 'info' | 'error' | 'success';
}

const PAYMENT_BADGES: Record<PaymentStatus, PaymentBadgeConfig> = {
  UNPAID:           { label: 'Pendiente de pago',       colorKey: 'warning' },
  UNDER_REVIEW:     { label: 'Comprobante en revisión', colorKey: 'info'    },
  NEEDS_CORRECTION: { label: 'Requiere corrección',     colorKey: 'error'   },
  VERIFIED:         { label: 'Pagado',                  colorKey: 'success' },
};

export const getPaymentBadge = (s: PaymentStatus): PaymentBadgeConfig => PAYMENT_BADGES[s];

export function canClientSubmitProof(
  p: Pick<CommissionPayment, 'status' | 'payment_status'>,
): boolean {
  return (
    p.status === 'EN_PROGRESO' &&
    (p.payment_status === 'UNPAID' || p.payment_status === 'NEEDS_CORRECTION')
  );
}

export function canArtistReviewPayment(
  p: Pick<CommissionPayment, 'status' | 'payment_status'>,
): boolean {
  return p.status === 'EN_PROGRESO' && p.payment_status === 'UNDER_REVIEW';
}

export const CLIENT_PAYMENT_MESSAGES: Record<PaymentStatus, string> = {
  UNPAID:           'Aún no has enviado tu comprobante de pago',
  UNDER_REVIEW:     'Tu comprobante está en revisión por el artista',
  NEEDS_CORRECTION: 'El artista pidió corregir tu comprobante',
  VERIFIED:         'Pago verificado por el artista',
};

export const ARTIST_PAYMENT_MESSAGES: Record<PaymentStatus, string> = {
  UNPAID:           'El cliente aún no ha enviado su comprobante de pago',
  UNDER_REVIEW:     'Revisa el comprobante del cliente',
  NEEDS_CORRECTION: 'Pediste al cliente corregir su comprobante',
  VERIFIED:         'Pago confirmado',
};

export const CORRECTION_SUGGESTIONS = [
  'Comprobante ilegible',
  'Monto incompleto',
  'No se recibió el depósito',
  'Los datos no coinciden con mi cuenta',
] as const;
