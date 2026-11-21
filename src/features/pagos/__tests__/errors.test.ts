import { toPaymentError, PaymentError } from '../errors';
import type { PaymentAction } from '../errors';
import type { PaymentRpcErrorCode } from '../types';

// ── toPaymentError — returns PaymentError instance ───────────────────────────

describe('toPaymentError — instance type', () => {
  it('always returns a PaymentError', () => {
    const err = toPaymentError('SUBMIT_PROOF', new Error('something'));
    expect(err).toBeInstanceOf(PaymentError);
    expect(err).toBeInstanceOf(Error);
  });
});

// ── toPaymentError — fallback messages ───────────────────────────────────────

describe('toPaymentError — fallback (unknown code)', () => {
  const cases: { action: PaymentAction; snippet: string }[] = [
    { action: 'SUBMIT_PROOF',       snippet: 'comprobante' },
    { action: 'VERIFY',             snippet: 'pago' },
    { action: 'REQUEST_CORRECTION', snippet: 'devolución' },
    { action: 'SUBMIT_DELIVERABLE', snippet: 'entregable' },
  ];

  it.each(cases)('$action uses fallback text containing "$snippet"', ({ action, snippet }) => {
    const err = toPaymentError(action, new Error('totally_unknown_code'));
    expect(err.message.toLowerCase()).toContain(snippet.toLowerCase());
    expect(err.code).toBeUndefined();
  });
});

// ── toPaymentError — known error codes ───────────────────────────────────────

describe('toPaymentError — invalid_payment_state', () => {
  const code: PaymentRpcErrorCode = 'invalid_payment_state';

  it('SUBMIT_PROOF → specific message, code set', () => {
    const err = toPaymentError('SUBMIT_PROOF', new Error(code));
    expect(err.message).toContain('comprobante');
    expect(err.code).toBe(code);
  });

  it('VERIFY → specific message, code set', () => {
    const err = toPaymentError('VERIFY', new Error(code));
    expect(err.message).toContain('revisión');
    expect(err.code).toBe(code);
  });

  it('REQUEST_CORRECTION → specific message, code set', () => {
    const err = toPaymentError('REQUEST_CORRECTION', new Error(code));
    expect(err.message).toContain('revisión');
    expect(err.code).toBe(code);
  });
});

describe('toPaymentError — invalid_reason', () => {
  it('REQUEST_CORRECTION → mentions motivo', () => {
    const err = toPaymentError('REQUEST_CORRECTION', new Error('invalid_reason'));
    expect(err.message).toContain('motivo');
    expect(err.code).toBe('invalid_reason');
  });
});

describe('toPaymentError — invalid_stage', () => {
  it('SUBMIT_DELIVERABLE → mentions etapa', () => {
    const err = toPaymentError('SUBMIT_DELIVERABLE', new Error('invalid_stage'));
    expect(err.message.toLowerCase()).toContain('etapa');
    expect(err.code).toBe('invalid_stage');
  });
});

describe('toPaymentError — file_too_large', () => {
  it('SUBMIT_DELIVERABLE → mentions tamaño', () => {
    const err = toPaymentError('SUBMIT_DELIVERABLE', new Error('file_too_large'));
    expect(err.message.toLowerCase()).toContain('tamaño');
    expect(err.code).toBe('file_too_large');
  });
});

describe('toPaymentError — null error', () => {
  it('falls back to fallback message when error is null', () => {
    const err = toPaymentError('VERIFY', null);
    expect(err).toBeInstanceOf(PaymentError);
    expect(err.code).toBeUndefined();
  });
});
