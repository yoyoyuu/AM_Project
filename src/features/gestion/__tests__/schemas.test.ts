import { rejectCommissionSchema } from '../schemas';

describe('rejectCommissionSchema', () => {
  it('accepts undefined (campo omitido)', () => {
    expect(rejectCommissionSchema.safeParse({}).success).toBe(true);
  });

  it('accepts empty string as valid input', () => {
    expect(
      rejectCommissionSchema.safeParse({ rejection_reason: '' }).success,
    ).toBe(true);
  });

  it('accepts a valid reason within 500 characters', () => {
    expect(
      rejectCommissionSchema.safeParse({
        rejection_reason: 'No tengo capacidad esta semana',
      }).success,
    ).toBe(true);
  });

  it('accepts a reason of exactly 500 characters', () => {
    expect(
      rejectCommissionSchema.safeParse({ rejection_reason: 'x'.repeat(500) }).success,
    ).toBe(true);
  });

  it('rejects a reason of 501 characters with the literal error message', () => {
    const result = rejectCommissionSchema.safeParse({
      rejection_reason: 'x'.repeat(501),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message;
      expect(message).toBe('El motivo no puede superar los 500 caracteres');
    }
  });
});
