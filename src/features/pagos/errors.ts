import type { PostgrestError } from '@supabase/supabase-js';
import type { PaymentRpcErrorCode } from './types';

export type PaymentAction = 'SUBMIT_PROOF' | 'VERIFY' | 'REQUEST_CORRECTION' | 'SUBMIT_DELIVERABLE';

const FALLBACK: Record<PaymentAction, string> = {
  SUBMIT_PROOF:       'No se pudo subir el comprobante, inténtalo de nuevo',
  VERIFY:             'No se pudo actualizar el estado del pago',
  REQUEST_CORRECTION: 'No se pudo procesar la devolución del comprobante',
  SUBMIT_DELIVERABLE: 'No se pudo subir el entregable. Comprueba tu conexión e inténtalo de nuevo',
};

const BY_CODE: Partial<Record<PaymentRpcErrorCode, Partial<Record<PaymentAction, string>>>> = {
  invalid_payment_state: {
    SUBMIT_PROOF:       'No puedes subir un comprobante en este momento',
    VERIFY:             'Este comprobante ya no está en revisión',
    REQUEST_CORRECTION: 'Este comprobante ya no está en revisión',
  },
  invalid_reason: {
    REQUEST_CORRECTION: 'Indica el motivo de la corrección (mínimo 5 caracteres)',
  },
  invalid_stage: {
    SUBMIT_DELIVERABLE: 'Solo puedes subir el entregable final en la etapa Color / Acabado final',
  },
  file_too_large: {
    SUBMIT_DELIVERABLE: 'El archivo supera el tamaño máximo de 10 MB incluso después de optimizarlo',
  },
};

export class PaymentError extends Error {
  constructor(message: string, readonly code?: PaymentRpcErrorCode) {
    super(message);
  }
}

export function toPaymentError(
  action: PaymentAction,
  error: PostgrestError | Error | null,
): PaymentError {
  const raw = error?.message ?? '';
  const code = raw as PaymentRpcErrorCode;
  return new PaymentError(
    BY_CODE[code]?.[action] ?? FALLBACK[action],
    BY_CODE[code] ? code : undefined,
  );
}
