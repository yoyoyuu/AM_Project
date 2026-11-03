import { signIn, signOut, signUp } from './api';
import { messages } from './messages';
import { supabase } from '../../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const mockedAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;

const mockUser: User = {
  id: 'user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'artist@example.com',
  email_confirmed_at: undefined,
  phone: '',
  confirmed_at: undefined,
  last_sign_in_at: undefined,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_anonymous: false,
};

const mockSession: Session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1893456000,
  token_type: 'bearer',
  user: mockUser,
};

describe('auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs up with privacy metadata', async () => {
    const response = {
      data: { user: mockUser, session: mockSession },
      error: null,
    };
    mockedAuth.signUp.mockResolvedValue(response);

    await expect(
      signUp({
        email: 'artist@example.com',
        password: 'secure-password',
        privacyAccepted: true,
      }),
    ).resolves.toEqual({ data: response.data, error: null });

    expect(mockedAuth.signUp).toHaveBeenCalledWith({
      email: 'artist@example.com',
      password: 'secure-password',
      options: {
        data: {
          privacy_accepted: true,
          privacy_notice_version: 'v1',
        },
      },
    });
  });

  it('translates sign-up errors', async () => {
    mockedAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'weak_password' } as never,
    });

    await expect(
      signUp({
        email: 'artist@example.com',
        password: 'secure-password',
        privacyAccepted: true,
      }),
    ).resolves.toEqual({ data: null, error: messages.passwordTooShort });
  });

  it('signs in with email and password', async () => {
    const response = {
      data: { user: mockUser, session: mockSession },
      error: null,
    };
    mockedAuth.signInWithPassword.mockResolvedValue(response);

    await expect(
      signIn({
        email: 'artist@example.com',
        password: 'secure-password',
      }),
    ).resolves.toEqual({ data: response.data, error: null });
  });

  it('translates sign-in errors without revealing the failed field', async () => {
    mockedAuth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: { code: 'invalid_credentials' } as never,
    });

    await expect(
      signIn({
        email: 'artist@example.com',
        password: 'wrong-password',
      }),
    ).resolves.toEqual({ data: null, error: messages.invalidCredentials });
  });

  it('signs out and translates sign-out errors', async () => {
    mockedAuth.signOut.mockResolvedValue({
      error: { code: 'over_request_rate_limit' } as never,
    });

    await expect(signOut()).resolves.toEqual({
      data: null,
      error: messages.tooManyAttempts,
    });
  });
});
