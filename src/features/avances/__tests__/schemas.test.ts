import { uploadAdvanceSchema } from '../schemas';

describe('uploadAdvanceSchema', () => {
  it('accepts undefined (campo omitido)', () => {
    expect(uploadAdvanceSchema.safeParse({}).success).toBe(true);
  });

  it('accepts empty string', () => {
    expect(uploadAdvanceSchema.safeParse({ note: '' }).success).toBe(true);
  });

  it('accepts a note within 300 characters', () => {
    expect(
      uploadAdvanceSchema.safeParse({ note: 'Boceto inicial listo' }).success,
    ).toBe(true);
  });

  it('accepts a note of exactly 300 characters', () => {
    expect(
      uploadAdvanceSchema.safeParse({ note: 'x'.repeat(300) }).success,
    ).toBe(true);
  });

  it('rejects a note of 301 characters with the literal error message', () => {
    const result = uploadAdvanceSchema.safeParse({ note: 'x'.repeat(301) });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message;
      expect(message).toBe('La nota no puede superar los 300 caracteres');
    }
  });
});
