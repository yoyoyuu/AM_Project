import { MESSAGES } from './messages';

type CatalogoErrorLike = {
  code?: unknown;
  constraint?: unknown;
  details?: unknown;
  message?: unknown;
};

function isErrorLike(error: unknown): error is CatalogoErrorLike {
  return typeof error === 'object' && error !== null;
}

function getStringProperty(
  error: CatalogoErrorLike,
  property: keyof CatalogoErrorLike,
): string {
  const value = error[property];
  return typeof value === 'string' ? value : '';
}

export const catalogoErrors = {
  handle(error: unknown): string {
    const errorLike = isErrorLike(error) ? error : {};
    const code = getStringProperty(errorLike, 'code');
    const constraint = getStringProperty(errorLike, 'constraint');
    const message = getStringProperty(errorLike, 'message');
    const details = getStringProperty(errorLike, 'details');
    const databaseError = `${message} ${details} ${constraint}`;
    const normalizedMessage = databaseError.toLowerCase();

    if (
      normalizedMessage.includes('networkerror') ||
      normalizedMessage.includes('failed to fetch') ||
      normalizedMessage.includes('network request failed')
    ) {
      return MESSAGES.noConnection;
    }

    if (
      code === 'P0001' &&
      normalizedMessage.includes('services_limit_reached')
    ) {
      return MESSAGES.limitReached;
    }

    if (normalizedMessage.includes('services_limit_reached')) {
      return MESSAGES.limitReached;
    }

    if (normalizedMessage.includes('not_an_artist')) {
      return MESSAGES.notAnArtist;
    }

    if (code === '23503') {
      return MESSAGES.activeCommissions;
    }

    if (normalizedMessage.includes('services_title_len')) {
      return MESSAGES.titleLen;
    }

    if (normalizedMessage.includes('services_price_positive')) {
      return MESSAGES.pricePositive;
    }

    if (normalizedMessage.includes('services_delivery_days_range')) {
      return MESSAGES.deliveryRange;
    }

    if (normalizedMessage.includes('services_description_len')) {
      return MESSAGES.descriptionLen;
    }

    if (normalizedMessage.includes('artist_tos_content_len')) {
      return MESSAGES.tosLen;
    }

    return MESSAGES.generic;
  },
};
