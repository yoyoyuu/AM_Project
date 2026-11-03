import { getAuthErrorMessage } from './errors';
import type { LoginInput, RegistrationInput } from './schemas';
import { supabase } from '../../lib/supabase';

type AuthResponse<T> = {
  data: T | null;
  error: string | null;
};

type SignUpData = Awaited<ReturnType<typeof supabase.auth.signUp>>['data'];
type SignInData = Awaited<
  ReturnType<typeof supabase.auth.signInWithPassword>
>['data'];

export async function signUp(
  input: RegistrationInput,
): Promise<AuthResponse<SignUpData>> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        privacy_accepted: input.privacyAccepted,
        privacy_notice_version: 'v1',
      },
    },
  });

  return {
    data: error === null ? data : null,
    error: error === null ? null : getAuthErrorMessage(error),
  };
}

export async function signIn(
  input: LoginInput,
): Promise<AuthResponse<SignInData>> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  return {
    data: error === null ? data : null,
    error: error === null ? null : getAuthErrorMessage(error),
  };
}

export async function signOut(): Promise<AuthResponse<null>> {
  const { error } = await supabase.auth.signOut();

  return {
    data: null,
    error: error === null ? null : getAuthErrorMessage(error),
  };
}
