import {
  getPaymentBadge,
  canClientSubmitProof,
  canArtistReviewPayment,
  CLIENT_PAYMENT_MESSAGES,
  ARTIST_PAYMENT_MESSAGES,
} from '../presenters';
import type { PaymentStatus } from '../types';

// ── getPaymentBadge ───────────────────────────────────────────────────────────

describe('getPaymentBadge', () => {
  it('UNPAID → warning', () => {
    expect(getPaymentBadge('UNPAID')).toEqual({ label: 'Pendiente de pago', colorKey: 'warning' });
  });

  it('UNDER_REVIEW → info', () => {
    expect(getPaymentBadge('UNDER_REVIEW')).toEqual({
      label: 'Comprobante en revisión',
      colorKey: 'info',
    });
  });

  it('NEEDS_CORRECTION → error', () => {
    expect(getPaymentBadge('NEEDS_CORRECTION')).toEqual({
      label: 'Requiere corrección',
      colorKey: 'error',
    });
  });

  it('VERIFIED → success', () => {
    expect(getPaymentBadge('VERIFIED')).toEqual({ label: 'Pagado', colorKey: 'success' });
  });
});

// ── canClientSubmitProof ──────────────────────────────────────────────────────

describe('canClientSubmitProof', () => {
  const cases: { status: string; payment_status: PaymentStatus; expected: boolean }[] = [
    { status: 'EN_PROGRESO', payment_status: 'UNPAID',           expected: true  },
    { status: 'EN_PROGRESO', payment_status: 'NEEDS_CORRECTION', expected: true  },
    { status: 'EN_PROGRESO', payment_status: 'UNDER_REVIEW',     expected: false },
    { status: 'EN_PROGRESO', payment_status: 'VERIFIED',         expected: false },
    { status: 'COMPLETADA',  payment_status: 'UNPAID',           expected: false },
    { status: 'PENDIENTE',   payment_status: 'UNPAID',           expected: false },
  ];

  it.each(cases)(
    'status=$status payment_status=$payment_status → $expected',
    ({ status, payment_status, expected }) => {
      expect(canClientSubmitProof({ status: status as never, payment_status })).toBe(expected);
    },
  );
});

// ── canArtistReviewPayment ────────────────────────────────────────────────────

describe('canArtistReviewPayment', () => {
  it('EN_PROGRESO + UNDER_REVIEW → true', () => {
    expect(canArtistReviewPayment({ status: 'EN_PROGRESO', payment_status: 'UNDER_REVIEW' })).toBe(true);
  });

  it('EN_PROGRESO + UNPAID → false', () => {
    expect(canArtistReviewPayment({ status: 'EN_PROGRESO', payment_status: 'UNPAID' })).toBe(false);
  });

  it('EN_PROGRESO + VERIFIED → false', () => {
    expect(canArtistReviewPayment({ status: 'EN_PROGRESO', payment_status: 'VERIFIED' })).toBe(false);
  });

  it('COMPLETADA + UNDER_REVIEW → false', () => {
    expect(canArtistReviewPayment({ status: 'COMPLETADA', payment_status: 'UNDER_REVIEW' })).toBe(false);
  });
});

// ── CLIENT_PAYMENT_MESSAGES ───────────────────────────────────────────────────

describe('CLIENT_PAYMENT_MESSAGES', () => {
  const statuses: PaymentStatus[] = ['UNPAID', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'VERIFIED'];

  it.each(statuses)('%s has a non-empty string message', (s) => {
    expect(typeof CLIENT_PAYMENT_MESSAGES[s]).toBe('string');
    expect(CLIENT_PAYMENT_MESSAGES[s].length).toBeGreaterThan(0);
  });
});

// ── ARTIST_PAYMENT_MESSAGES ───────────────────────────────────────────────────

describe('ARTIST_PAYMENT_MESSAGES', () => {
  const statuses: PaymentStatus[] = ['UNPAID', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'VERIFIED'];

  it.each(statuses)('%s has a non-empty string message', (s) => {
    expect(typeof ARTIST_PAYMENT_MESSAGES[s]).toBe('string');
    expect(ARTIST_PAYMENT_MESSAGES[s].length).toBeGreaterThan(0);
  });
});
