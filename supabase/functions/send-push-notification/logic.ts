// Spec 008 — Notificaciones Push — Edge Function send-push-notification
// Lógica pura: consumida por index.ts (Deno) y por logic.test.ts (Jest).
// Sin imports a propósito.

export const PUSH_EVENTS = [
  'NEW_REQUEST',
  'PAYMENT_PROOF_SUBMITTED',
  'REQUEST_UPDATED',
  'STAGE_ADVANCED',
  'NEW_ADVANCE',
  'PAYMENT_UPDATED',
  'DELIVERABLE_READY',
] as const;

export type PushEvent = (typeof PUSH_EVENTS)[number];
export type PushTarget = 'artist_request' | 'artist_work' | 'client_tracking';

export const NOTIFICATION_TITLE = 'Koma';
export const ANDROID_CHANNEL_ID = 'default';

/** Textos literales de la spec §5 / §8.3. Única fuente de contenido visible. */
export const EVENT_CONTENT: Record<PushEvent, { body: string; target: PushTarget }> = {
  NEW_REQUEST:             { body: 'Tienes una nueva solicitud de comisión',           target: 'artist_request' },
  PAYMENT_PROOF_SUBMITTED: { body: 'Un cliente subió un comprobante de pago',          target: 'artist_work' },
  REQUEST_UPDATED:         { body: 'Hay una actualización en tu solicitud de comisión', target: 'client_tracking' },
  STAGE_ADVANCED:          { body: 'Tu comisión avanzó a una nueva etapa',             target: 'client_tracking' },
  NEW_ADVANCE:             { body: 'Tienes un nuevo avance disponible',                target: 'client_tracking' },
  PAYMENT_UPDATED:         { body: 'Se actualizó el estado de tu pago',                target: 'client_tracking' },
  DELIVERABLE_READY:       { body: 'Tu entregable final está listo',                   target: 'client_tracking' },
};

export interface PushRequest {
  event: PushEvent;
  commission_id: string;
  recipient_id: string;
}

export interface PushData {
  commission_id: string;
  target: PushTarget;
  recipient_id: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: PushData;
  channelId: typeof ANDROID_CHANNEL_ID;
  priority: 'high';
  sound: 'default';
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePushRequest(body: unknown): PushRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { event, commission_id, recipient_id } = body as Record<string, unknown>;
  if (typeof event !== 'string' || !(PUSH_EVENTS as readonly string[]).includes(event)) return null;
  if (typeof commission_id !== 'string' || !UUID_RE.test(commission_id)) return null;
  if (typeof recipient_id !== 'string' || !UUID_RE.test(recipient_id)) return null;
  return { event: event as PushEvent, commission_id, recipient_id };
}

export function buildMessages(req: PushRequest, tokens: string[]): ExpoPushMessage[] {
  const { body, target } = EVENT_CONTENT[req.event];
  return tokens.map((to) => ({
    to,
    title: NOTIFICATION_TITLE,
    body,
    data: { commission_id: req.commission_id, target, recipient_id: req.recipient_id },
    channelId: ANDROID_CHANNEL_ID,
    priority: 'high',
    sound: 'default',
  }));
}

/** Los tickets vienen en el mismo orden que los mensajes enviados. */
export function collectUnregisteredTokens(
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[],
): string[] {
  return tickets.flatMap((t, i) =>
    t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i]
      ? [messages[i].to]
      : [],
  );
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Comparación en tiempo constante para el secreto del webhook. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Reintentar solo errores transitorios: red (status null), 429 y 5xx. */
export function isRetryableStatus(status: number | null): boolean {
  return status === null || status === 429 || status >= 500;
}
