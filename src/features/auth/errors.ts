import { messages } from './messages';

type AuthErrorLike = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
  name?: unknown;
};

const genericErrorMessage =
  'No se pudo completar la acción, inténtalo de nuevo';

const otpErrorCodes = new Set([
  'otp_expired',
  'otp_disabled',
  'invalid_otp',
  'otp_invalid',
  'token_expired',
  'invalid_token',
]);

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  return typeof error === 'object' && error !== null;
}

function getStringProperty(
  error: AuthErrorLike,
  property: keyof AuthErrorLike,
): string | undefined {
  const value = error[property];
  return typeof value === 'string' ? value : undefined;
}

function isNetworkError(error: unknown, message: string | undefined): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  const normalizedMessage = message?.toLowerCase() ?? '';
  return (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('connection')
  );
}

export function getAuthErrorMessage(error: unknown): string {
  const errorLike = isAuthErrorLike(error) ? error : {};
  const code = getStringProperty(errorLike, 'code');
  const constraint = getStringProperty(errorLike, 'constraint');
  const message = getStringProperty(errorLike, 'message');

  if (isNetworkError(error, message)) {
    return messages.connectionFailure;
  }

  if (code === 'user_already_exists' || code === 'email_exists') {
    return messages.emailAlreadyRegistered;
  }

  if (code === 'invalid_credentials') {
    return messages.invalidCredentials;
  }

  if (code === 'email_not_confirmed') {
    return messages.emailNotConfirmed;
  }

  if (code === 'weak_password') {
    return messages.passwordTooShort;
  }

  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit'
  ) {
    return messages.tooManyAttempts;
  }

  if (code !== undefined && otpErrorCodes.has(code)) {
    return messages.invalidVerificationCode;
  }

  if (code === '23505') {
    return constraint === 'profiles_handle_key'
      ? messages.duplicateHandle
      : genericErrorMessage;
  }

  if (code === '23514') {
    if (constraint === 'profiles_handle_reserved') {
      return messages.reservedHandle;
    }
    if (constraint === 'profiles_handle_format') {
      return messages.invalidHandle;
    }
    if (constraint === 'profiles_display_name_len') {
      return messages.invalidDisplayName;
    }
  }

  return genericErrorMessage;
}
