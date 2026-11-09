import { commissionRequestSchema } from '../schemas';

const validBase = {
  description: 'Descripción válida con más de veinte caracteres aquí',
  intended_use: 'personal' as const,
};

describe('commissionRequestSchema — description', () => {
  it('acepta descripción en el límite mínimo (20 caracteres)', () => {
    const result = commissionRequestSchema.safeParse({
      ...validBase,
      description: 'a'.repeat(20),
    });
    expect(result.success).toBe(true);
  });

  it('acepta descripción en el límite máximo (2000 caracteres)', () => {
    const result = commissionRequestSchema.safeParse({
      ...validBase,
      description: 'a'.repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it('rechaza descripción vacía con mensaje correcto', () => {
    const result = commissionRequestSchema.safeParse({
      ...validBase,
      description: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === 'description')?.message;
      expect(msg).toBe('La descripción debe tener al menos 20 caracteres');
    }
  });

  it('rechaza descripción con 19 caracteres con mensaje correcto', () => {
    const result = commissionRequestSchema.safeParse({
      ...validBase,
      description: 'a'.repeat(19),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === 'description')?.message;
      expect(msg).toBe('La descripción debe tener al menos 20 caracteres');
    }
  });

  it('rechaza descripción con 2001 caracteres con mensaje correcto', () => {
    const result = commissionRequestSchema.safeParse({
      ...validBase,
      description: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === 'description')?.message;
      expect(msg).toBe('La descripción no puede superar los 2 000 caracteres');
    }
  });
});

describe('commissionRequestSchema — intended_use', () => {
  it('acepta "personal"', () => {
    expect(commissionRequestSchema.safeParse({ ...validBase, intended_use: 'personal' }).success).toBe(true);
  });

  it('acepta "comercial"', () => {
    expect(commissionRequestSchema.safeParse({ ...validBase, intended_use: 'comercial' }).success).toBe(true);
  });

  it('rechaza valor inválido con mensaje correcto', () => {
    const result = commissionRequestSchema.safeParse({
      ...validBase,
      intended_use: 'otro',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === 'intended_use')?.message;
      expect(msg).toBe('Indica el uso previsto de la comisión');
    }
  });

  it('rechaza intended_use ausente con mensaje correcto', () => {
    const { intended_use: _, ...sinUso } = validBase;
    const result = commissionRequestSchema.safeParse(sinUso);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === 'intended_use')?.message;
      expect(msg).toBe('Indica el uso previsto de la comisión');
    }
  });
});

describe('commissionRequestSchema — campos opcionales (límite 500)', () => {
  const optionalFields = ['pose', 'key_elements', 'additional_notes'] as const;

  for (const field of optionalFields) {
    it(`acepta ${field} ausente`, () => {
      expect(commissionRequestSchema.safeParse(validBase).success).toBe(true);
    });

    it(`acepta ${field} en el límite (500 caracteres)`, () => {
      const result = commissionRequestSchema.safeParse({
        ...validBase,
        [field]: 'a'.repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it(`rechaza ${field} con 501 caracteres con mensaje correcto`, () => {
      const result = commissionRequestSchema.safeParse({
        ...validBase,
        [field]: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path[0] === field)?.message;
        expect(msg).toBe('Este campo no puede superar los 500 caracteres');
      }
    });
  }
});

describe('commissionRequestSchema — terms_accepted', () => {
  it('acepta terms_accepted ausente (campo opcional en Zod)', () => {
    expect(commissionRequestSchema.safeParse(validBase).success).toBe(true);
  });

  it('acepta terms_accepted true', () => {
    expect(
      commissionRequestSchema.safeParse({ ...validBase, terms_accepted: true }).success,
    ).toBe(true);
  });

  it('acepta terms_accepted false (validación real ocurre en submit handler)', () => {
    expect(
      commissionRequestSchema.safeParse({ ...validBase, terms_accepted: false }).success,
    ).toBe(true);
  });
});
