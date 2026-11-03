import { getAuthErrorMessage } from './errors';
import { messages } from './messages';

describe('getAuthErrorMessage', () => {
  it.each([
    ['invalid_credentials', messages.invalidCredentials],
    ['email_not_confirmed', messages.emailNotConfirmed],
    ['weak_password', messages.passwordTooShort],
    ['over_request_rate_limit', messages.tooManyAttempts],
    ['over_email_send_rate_limit', messages.tooManyAttempts],
    ['otp_expired', messages.invalidVerificationCode],
  ])('maps Supabase code "%s"', (code, expectedMessage) => {
    expect(getAuthErrorMessage({ code })).toBe(expectedMessage);
  });

  it('maps a duplicate handle constraint to its message', () => {
    expect(
      getAuthErrorMessage({
        code: '23505',
        constraint: 'profiles_handle_key',
      }),
    ).toBe(messages.duplicateHandle);
  });

  it('maps reserved and malformed handle constraints', () => {
    expect(
      getAuthErrorMessage({
        code: '23514',
        constraint: 'profiles_handle_reserved',
      }),
    ).toBe(messages.reservedHandle);
    expect(
      getAuthErrorMessage({
        code: '23514',
        constraint: 'profiles_handle_format',
      }),
    ).toBe(messages.invalidHandle);
  });

  it('maps a network error', () => {
    expect(getAuthErrorMessage(new TypeError('Network request failed'))).toBe(
      messages.connectionFailure,
    );
  });

  it('uses the generic message for unknown errors', () => {
    expect(getAuthErrorMessage({ code: 'unexpected_error' })).toBe(
      'No se pudo completar la acción, inténtalo de nuevo',
    );
  });
});
