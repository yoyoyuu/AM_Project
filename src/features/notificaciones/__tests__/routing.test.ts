import { parsePushData, resolveNotificationRoute } from '../routing';

const VALID_COMMISSION = '6f1cfa5e-1234-4abc-9def-abcdef123456';
const VALID_RECIPIENT  = 'a2b9c3d4-5678-4abc-9def-abcdef654321';
const OTHER_USER       = 'cccccccc-1234-4abc-9def-abcdef111111';

describe('parsePushData', () => {
  it('returns the data object when all fields are valid', () => {
    const result = parsePushData({
      commission_id: VALID_COMMISSION,
      target: 'client_tracking',
      recipient_id: VALID_RECIPIENT,
    });
    expect(result).toEqual({
      commission_id: VALID_COMMISSION,
      target: 'client_tracking',
      recipient_id: VALID_RECIPIENT,
    });
  });

  it('accepts the three valid targets', () => {
    for (const target of ['artist_request', 'artist_work', 'client_tracking'] as const) {
      expect(
        parsePushData({ commission_id: VALID_COMMISSION, target, recipient_id: VALID_RECIPIENT }),
      ).not.toBeNull();
    }
  });

  it('returns null when target is unknown', () => {
    expect(
      parsePushData({ commission_id: VALID_COMMISSION, target: 'unknown', recipient_id: VALID_RECIPIENT }),
    ).toBeNull();
  });

  it('returns null when commission_id is not a UUID', () => {
    expect(
      parsePushData({ commission_id: 'not-a-uuid', target: 'client_tracking', recipient_id: VALID_RECIPIENT }),
    ).toBeNull();
  });

  it('returns null when recipient_id is not a UUID', () => {
    expect(
      parsePushData({ commission_id: VALID_COMMISSION, target: 'client_tracking', recipient_id: 'xxx' }),
    ).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parsePushData(null)).toBeNull();
    expect(parsePushData(undefined)).toBeNull();
    expect(parsePushData('string')).toBeNull();
    expect(parsePushData(42)).toBeNull();
  });

  it('returns null when required keys are missing', () => {
    expect(parsePushData({ commission_id: VALID_COMMISSION })).toBeNull();
    expect(parsePushData({ target: 'client_tracking' })).toBeNull();
  });
});

describe('resolveNotificationRoute', () => {
  const data = (target: 'artist_request' | 'artist_work' | 'client_tracking') => ({
    commission_id: VALID_COMMISSION,
    target,
    recipient_id: VALID_RECIPIENT,
  });

  it('routes artist_request to /artist/commissions/[commissionId]', () => {
    expect(resolveNotificationRoute(data('artist_request'), VALID_RECIPIENT)).toEqual({
      pathname: '/artist/commissions/[commissionId]',
      params: { commissionId: VALID_COMMISSION },
    });
  });

  it('routes artist_work to /artist/commissions/[commissionId]/work', () => {
    expect(resolveNotificationRoute(data('artist_work'), VALID_RECIPIENT)).toEqual({
      pathname: '/artist/commissions/[commissionId]/work',
      params: { commissionId: VALID_COMMISSION },
    });
  });

  it('routes client_tracking to /commissions/[commissionId]', () => {
    expect(resolveNotificationRoute(data('client_tracking'), VALID_RECIPIENT)).toEqual({
      pathname: '/commissions/[commissionId]',
      params: { commissionId: VALID_COMMISSION },
    });
  });

  it('returns null when recipient_id does not match current user (Escenario 8.26)', () => {
    expect(resolveNotificationRoute(data('client_tracking'), OTHER_USER)).toBeNull();
  });

  it('returns null when there is no session (currentUserId = null)', () => {
    expect(resolveNotificationRoute(data('client_tracking'), null)).toBeNull();
  });
});
