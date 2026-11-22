import {
  buildMessages,
  chunk,
  collectUnregisteredTokens,
  EVENT_CONTENT,
  isRetryableStatus,
  NOTIFICATION_TITLE,
  parsePushRequest,
  PUSH_EVENTS,
  timingSafeEqual,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type PushEvent,
  type PushRequest,
} from './logic';

const VALID_COMMISSION = '6f1cfa5e-1234-4abc-9def-abcdef123456';
const VALID_RECIPIENT  = 'a2b9c3d4-5678-4abc-9def-abcdef654321';

const validRequest = (event: PushEvent = 'STAGE_ADVANCED'): PushRequest => ({
  event,
  commission_id: VALID_COMMISSION,
  recipient_id: VALID_RECIPIENT,
});

// ═══════════════════════════════════════════════════════════════════
// parsePushRequest
// ═══════════════════════════════════════════════════════════════════
describe('parsePushRequest', () => {
  it('returns the request for a valid payload', () => {
    const r = parsePushRequest(validRequest());
    expect(r).toEqual(validRequest());
  });

  it('accepts all 7 known events', () => {
    for (const event of PUSH_EVENTS) {
      expect(
        parsePushRequest({ event, commission_id: VALID_COMMISSION, recipient_id: VALID_RECIPIENT }),
      ).not.toBeNull();
    }
  });

  it('returns null for an unknown event', () => {
    expect(
      parsePushRequest({ event: 'UNKNOWN', commission_id: VALID_COMMISSION, recipient_id: VALID_RECIPIENT }),
    ).toBeNull();
  });

  it('returns null for an invalid commission_id UUID', () => {
    expect(
      parsePushRequest({ event: 'NEW_REQUEST', commission_id: 'not-a-uuid', recipient_id: VALID_RECIPIENT }),
    ).toBeNull();
  });

  it('returns null for an invalid recipient_id UUID', () => {
    expect(
      parsePushRequest({ event: 'NEW_REQUEST', commission_id: VALID_COMMISSION, recipient_id: 'bad' }),
    ).toBeNull();
  });

  it('returns null for null', () => {
    expect(parsePushRequest(null)).toBeNull();
  });

  it('returns null for a string', () => {
    expect(parsePushRequest('string')).toBeNull();
  });

  it('returns null for a number', () => {
    expect(parsePushRequest(42)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildMessages
// ═══════════════════════════════════════════════════════════════════
describe('buildMessages', () => {
  const TOKEN = 'ExponentPushToken[abc]';

  it('produces one message per token', () => {
    const tokens = ['ExponentPushToken[a]', 'ExponentPushToken[b]', 'ExponentPushToken[c]'];
    const msgs = buildMessages(validRequest(), tokens);
    expect(msgs).toHaveLength(3);
    expect(msgs.map((m) => m.to)).toEqual(tokens);
  });

  it.each(PUSH_EVENTS)('for %s uses the spec literal body, title Koma and target', (event) => {
    const msg = buildMessages(validRequest(event), [TOKEN])[0]!;
    const content = EVENT_CONTENT[event];
    expect(msg.title).toBe(NOTIFICATION_TITLE);
    expect(msg.title).toBe('Koma');
    expect(msg.body).toBe(content.body);
    expect(msg.data.target).toBe(content.target);
    expect(msg.channelId).toBe('default');
    expect(msg.priority).toBe('high');
  });

  it('data object has EXACTLY three keys: commission_id, target, recipient_id', () => {
    const msg = buildMessages(validRequest(), [TOKEN])[0]!;
    expect(Object.keys(msg.data).sort()).toEqual(['commission_id', 'recipient_id', 'target']);
    expect(msg.data.commission_id).toBe(VALID_COMMISSION);
    expect(msg.data.recipient_id).toBe(VALID_RECIPIENT);
  });

  it('returns an empty array when there are no tokens', () => {
    expect(buildMessages(validRequest(), [])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Privacidad (RNF-NOT-8.1): ningún body revela datos de la comisión
// ═══════════════════════════════════════════════════════════════════
describe('EVENT_CONTENT privacy', () => {
  const forbiddenWords = ['Boceto', 'Delineado', 'Color'];
  const digits = /\d/;
  const dollar = /\$/;

  it.each(PUSH_EVENTS)('%s body has no digits, no $, no stage names', (event) => {
    const { body } = EVENT_CONTENT[event];
    expect(body).not.toMatch(digits);
    expect(body).not.toMatch(dollar);
    for (const word of forbiddenWords) {
      expect(body).not.toContain(word);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// collectUnregisteredTokens
// ═══════════════════════════════════════════════════════════════════
describe('collectUnregisteredTokens', () => {
  const makeMsg = (to: string): ExpoPushMessage => ({
    to,
    title: 'Koma',
    body: 'x',
    data: { commission_id: VALID_COMMISSION, target: 'client_tracking', recipient_id: VALID_RECIPIENT },
    channelId: 'default',
    priority: 'high',
    sound: 'default',
  });

  it('returns only tokens whose ticket has DeviceNotRegistered', () => {
    const messages = [makeMsg('t1'), makeMsg('t2'), makeMsg('t3'), makeMsg('t4')];
    const tickets: ExpoPushTicket[] = [
      { status: 'ok', id: 'r1' },
      { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', message: 'rate', details: { error: 'MessageRateExceeded' } },
    ];
    expect(collectUnregisteredTokens(messages, tickets)).toEqual(['t3']);
  });

  it('returns an empty array when all tickets are ok', () => {
    const messages = [makeMsg('t1'), makeMsg('t2')];
    const tickets: ExpoPushTicket[] = [{ status: 'ok' }, { status: 'ok' }];
    expect(collectUnregisteredTokens(messages, tickets)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// chunk
// ═══════════════════════════════════════════════════════════════════
describe('chunk', () => {
  it('splits 250 items into 100 / 100 / 50 at size 100', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const out = chunk(items, 100);
    expect(out).toHaveLength(3);
    expect(out[0]).toHaveLength(100);
    expect(out[1]).toHaveLength(100);
    expect(out[2]).toHaveLength(50);
  });

  it('returns a single chunk when items fit', () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// timingSafeEqual
// ═══════════════════════════════════════════════════════════════════
describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different-length strings', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// isRetryableStatus
// ═══════════════════════════════════════════════════════════════════
describe('isRetryableStatus', () => {
  it('returns true for null (network error)', () => {
    expect(isRetryableStatus(null)).toBe(true);
  });

  it('returns true for 429', () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it('returns true for 5xx', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('returns false for 400 / 401 / 404', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
