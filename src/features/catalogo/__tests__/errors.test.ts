import { catalogoErrors } from '../errors';
import { MESSAGES } from '../messages';

describe('catalogoErrors.handle', () => {
  it.each([
    ['NetworkError: request failed', MESSAGES.noConnection],
    ['Failed to fetch', MESSAGES.noConnection],
    ['Network request failed', MESSAGES.noConnection],
  ])('maps network error "%s"', (message, expected) => {
    expect(catalogoErrors.handle(new Error(message))).toBe(expected);
  });

  it('maps the services limit trigger code and message', () => {
    expect(
      catalogoErrors.handle({
        code: 'P0001',
        message: 'services_limit_reached',
      }),
    ).toBe(MESSAGES.limitReached);
  });

  it('maps a services limit message without a code', () => {
    expect(catalogoErrors.handle({ message: 'services_limit_reached' })).toBe(
      MESSAGES.limitReached,
    );
  });

  it('maps the not-an-artist error', () => {
    expect(catalogoErrors.handle({ message: 'not_an_artist' })).toBe(
      MESSAGES.notAnArtist,
    );
  });

  it('maps active commission deletion errors', () => {
    expect(catalogoErrors.handle({ code: '23503' })).toBe(
      MESSAGES.activeCommissions,
    );
  });

  it.each([
    ['services_title_len', MESSAGES.titleLen],
    ['services_price_positive', MESSAGES.pricePositive],
    ['services_delivery_days_range', MESSAGES.deliveryRange],
    ['services_description_len', MESSAGES.descriptionLen],
    ['artist_tos_content_len', MESSAGES.tosLen],
  ])('maps database constraint "%s"', (constraint, expected) => {
    expect(catalogoErrors.handle({ constraint })).toBe(expected);
  });

  it('uses the generic message for unknown errors', () => {
    expect(catalogoErrors.handle({ code: 'unexpected_error' })).toBe(
      MESSAGES.generic,
    );
    expect(catalogoErrors.handle(null)).toBe(MESSAGES.generic);
  });
});
