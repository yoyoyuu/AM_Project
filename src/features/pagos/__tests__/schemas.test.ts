import { paymentProofSchema, paymentCorrectionSchema } from '../schemas';

// ── paymentProofSchema ────────────────────────────────────────────────────────

describe('paymentProofSchema — reference field', () => {
  it('accepts undefined reference', () => {
    expect(paymentProofSchema.safeParse({ note: '' }).success).toBe(true);
  });

  it('accepts empty string reference', () => {
    expect(paymentProofSchema.safeParse({ reference: '', note: '' }).success).toBe(true);
  });

  it('accepts reference within 60 chars', () => {
    expect(
      paymentProofSchema.safeParse({ reference: 'REF-123', note: '' }).success,
    ).toBe(true);
  });

  it('rejects reference longer than 60 chars', () => {
    const result = paymentProofSchema.safeParse({ reference: 'x'.repeat(61), note: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/60/);
    }
  });

  it('trims whitespace so " " becomes "" (valid)', () => {
    expect(paymentProofSchema.safeParse({ reference: '   ', note: '' }).success).toBe(true);
  });
});

describe('paymentProofSchema — note field', () => {
  it('accepts undefined note', () => {
    expect(paymentProofSchema.safeParse({}).success).toBe(true);
  });

  it('accepts note within 300 chars', () => {
    expect(
      paymentProofSchema.safeParse({ note: 'short note' }).success,
    ).toBe(true);
  });

  it('rejects note longer than 300 chars', () => {
    const result = paymentProofSchema.safeParse({ note: 'x'.repeat(301) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/300/);
    }
  });
});

// ── paymentCorrectionSchema ───────────────────────────────────────────────────

describe('paymentCorrectionSchema', () => {
  it('accepts reason of exactly 5 chars', () => {
    expect(paymentCorrectionSchema.safeParse({ reason: 'abcde' }).success).toBe(true);
  });

  it('accepts reason within range', () => {
    expect(
      paymentCorrectionSchema.safeParse({ reason: 'Monto incorrecto en el comprobante' }).success,
    ).toBe(true);
  });

  it('rejects reason shorter than 5 chars', () => {
    const result = paymentCorrectionSchema.safeParse({ reason: 'abc' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/5/);
    }
  });

  it('rejects reason longer than 300 chars', () => {
    const result = paymentCorrectionSchema.safeParse({ reason: 'x'.repeat(301) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/300/);
    }
  });

  it('rejects empty reason', () => {
    expect(paymentCorrectionSchema.safeParse({ reason: '' }).success).toBe(false);
  });

  it('rejects whitespace-only reason after trim', () => {
    expect(paymentCorrectionSchema.safeParse({ reason: '    ' }).success).toBe(false);
  });
});
