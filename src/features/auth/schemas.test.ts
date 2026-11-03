import {
  displayNameSchema,
  handleSchema,
  loginSchema,
  profileSchema,
  registrationSchema,
} from './schemas';

describe('registrationSchema', () => {
  it('accepts valid registration data with privacy consent', () => {
    expect(
      registrationSchema.safeParse({
        email: 'artist@example.com',
        password: 'secure-password',
        privacyAccepted: true,
      }).success,
    ).toBe(true);
  });

  it('rejects invalid email, short password, and missing consent', () => {
    const result = registrationSchema.safeParse({
      email: 'not-an-email',
      password: 'short',
      privacyAccepted: false,
    });

    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    expect(
      loginSchema.safeParse({
        email: 'artist@example.com',
        password: 'secure-password',
      }).success,
    ).toBe(true);
  });

  it('rejects passwords shorter than eight characters', () => {
    expect(
      loginSchema.safeParse({
        email: 'artist@example.com',
        password: 'short',
      }).success,
    ).toBe(false);
  });
});

describe('displayNameSchema', () => {
  it.each([['A'], ['a'.repeat(51)]])(
    'rejects names outside the 2 to 50 character range',
    (displayName) => {
      expect(displayNameSchema.safeParse(displayName).success).toBe(false);
    },
  );

  it('accepts names at both boundaries', () => {
    expect(displayNameSchema.safeParse('Ab').success).toBe(true);
    expect(displayNameSchema.safeParse('a'.repeat(50)).success).toBe(true);
  });
});

describe('handleSchema', () => {
  it.each(['Artist', 'artist_name', '-artist', 'artist-', 'artist--name'])(
    'rejects invalid handle "%s"',
    (handle) => {
      expect(handleSchema.safeParse(handle).success).toBe(false);
    },
  );

  it.each(['art', 'artist-2026', 'a'.repeat(30)])(
    'accepts valid handle "%s"',
    (handle) => {
      expect(handleSchema.safeParse(handle).success).toBe(true);
    },
  );

  it('rejects reserved handles', () => {
    expect(handleSchema.safeParse('admin').success).toBe(false);
    expect(handleSchema.safeParse('comisiones').success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('accepts a valid profile', () => {
    expect(
      profileSchema.safeParse({
        displayName: 'Artista',
        handle: 'ilustrador',
      }).success,
    ).toBe(true);
  });
});
